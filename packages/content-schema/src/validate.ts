import { z } from "zod";
import {
  BLOCK_TYPES, CLINICAL_BLOCK_TYPES, blockRegistry,
  type Block, type BlockContentMap, type BlockType,
} from "./blocks";
import { issue, toResult, type Issue, type Result } from "./issues";
import { LOCALES, type Locale, type LocalizedString } from "./primitives";
import { collectClaimAnchors } from "./rich-text";

export interface RawBlock {
  id: string;
  position: number;
  type: string;
  schema_version: number;
  content: unknown;
  /** block_claims rows. Omit to skip claim checks (e.g. a block being typed in the editor). */
  claims?: { claim_id: string; anchor: string }[];
}

const isBlockType = (t: string): t is BlockType => (BLOCK_TYPES as readonly string[]).includes(t);

const zodIssues = (err: z.ZodError): Issue[] =>
  err.issues.map((i) => issue("invalid_shape", "error", i.path as (string | number)[], i.message));

/** Type-specific rules that a field-level schema cannot express. */
function crossFieldIssues<K extends BlockType>(type: K, content: BlockContentMap[K]): Issue[] {
  const out: Issue[] = [];
  const present = LOCALES.filter((l) => (content as Record<string, unknown>)[l] !== undefined);

  if (type === "comparison") {
    const c = content as BlockContentMap["comparison"];
    for (const l of present) {
      const p = c[l]!;
      p.rows.forEach((row, r) => {
        if (row.cells.length !== p.columns.length) {
          out.push(issue("comparison_cell_count", "error", [l, "rows", r, "cells"],
            `row has ${row.cells.length} cells, table has ${p.columns.length} columns`));
        }
      });
    }
    if (c.ar && c.en && (c.ar.columns.length !== c.en.columns.length || c.ar.rows.length !== c.en.rows.length)) {
      out.push(issue("locale_structure_mismatch", "warning", [], "ar and en tables have different shapes"));
    }
  }

  if (type === "interactive_diagram") {
    const c = content as BlockContentMap["interactive_diagram"];
    const sharedIds = c.shared.hotspots.map((h) => h.id);
    if (new Set(sharedIds).size !== sharedIds.length) {
      out.push(issue("duplicate_ids", "error", ["shared", "hotspots"], "hotspot ids must be unique"));
    }
    for (const l of present) {
      const labelIds = c[l]!.hotspots.map((h) => h.id);
      const missing = sharedIds.filter((id) => !labelIds.includes(id));
      const extra = labelIds.filter((id) => !sharedIds.includes(id));
      if (missing.length || extra.length) {
        out.push(issue("hotspot_mismatch", "error", [l, "hotspots"],
          `labels must match positioned hotspots (missing: ${missing.join(",") || "none"}; unknown: ${extra.join(",") || "none"})`));
      }
    }
  }

  if (type === "animation") {
    const c = content as BlockContentMap["animation"];
    if (c.ar && c.en && c.ar.step_labels.length !== c.en.step_labels.length) {
      out.push(issue("locale_structure_mismatch", "warning", [], "ar and en step labels differ in count"));
    }
  }
  return out;
}

/** Evidence rules: markers in text vs block_claims rows. */
function claimIssues(type: BlockType, content: Record<string, unknown>, claims: NonNullable<RawBlock["claims"]>): Issue[] {
  const out: Issue[] = [];
  const linked = new Set(claims.map((c) => c.anchor).filter((a) => a !== ""));
  const usedBy: Partial<Record<Locale, Set<string>>> = {};

  for (const l of LOCALES) {
    if (content[l] === undefined) continue;
    const used = new Set(collectClaimAnchors(content[l]));
    usedBy[l] = used;
    for (const a of used) {
      if (!linked.has(a)) {
        out.push(issue("claim_anchor_unlinked", "error", [l], `marker "${a}" has no linked claim`));
      }
    }
  }
  for (const a of linked) {
    if (!Object.values(usedBy).some((s) => s?.has(a))) {
      out.push(issue("claim_link_unused", "warning", [], `linked claim anchor "${a}" is not used in the text`));
    }
  }
  if (usedBy.ar && usedBy.en) {
    const diff = [...usedBy.ar].filter((a) => !usedBy.en!.has(a)).concat([...usedBy.en].filter((a) => !usedBy.ar!.has(a)));
    if (diff.length) {
      out.push(issue("locale_structure_mismatch", "warning", [], `claim markers differ between ar and en: ${diff.join(",")}`));
    }
  }
  if (CLINICAL_BLOCK_TYPES.has(type) && claims.length === 0) {
    out.push(issue("clinical_block_without_claims", "warning", [], `${type} block has no linked claims`));
  }
  return out;
}

/**
 * Parse and check one block. Never throws.
 * ok:false  -> the renderer hides the block; the CMS shows the issues.
 * ok:true   -> typed block; issues are warnings only.
 */
export function parseBlock(raw: RawBlock): Result<Block> {
  if (!isBlockType(raw.type)) {
    return { ok: false, issues: [issue("unknown_block_type", "error", ["type"], `unknown block type "${raw.type}"`)] };
  }
  const versions = blockRegistry[raw.type] as Record<number, z.ZodType | undefined>;
  const schema = versions[raw.schema_version];
  if (!schema) {
    return { ok: false, issues: [issue("unsupported_schema_version", "error", ["schema_version"],
      `${raw.type} schema_version ${raw.schema_version} is not supported by this client`)] };
  }
  const parsed = schema.safeParse(raw.content);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };

  const content = parsed.data as BlockContentMap[BlockType];
  const issues = [
    ...crossFieldIssues(raw.type, content),
    ...(raw.claims ? claimIssues(raw.type, content as Record<string, unknown>, raw.claims) : []),
  ];
  return toResult(
    { id: raw.id, position: raw.position, type: raw.type, schema_version: raw.schema_version,
      content, claims: raw.claims ?? [] } as Block,
    issues,
  );
}

export interface VersionReport {
  blocks: { id: string; result: Result<Block> }[];
  /** Locales in which the version is complete AND every block is valid. */
  completeLocales: Locale[];
  issues: Issue[];
}

/**
 * Whole-version check for the CMS, run before requesting a transition.
 * Stricter than the DB gate: the DB checks presence, this also checks shape.
 */
export function validateVersion(input: { title: LocalizedString | Record<string, unknown>; blocks: RawBlock[] }): VersionReport {
  const blocks = [...input.blocks].sort((a, b) => a.position - b.position)
    .map((b) => ({ id: b.id, result: parseBlock(b) }));
  const issues: Issue[] = [];
  if (blocks.length === 0) issues.push(issue("invalid_shape", "error", ["blocks"], "version has no blocks"));

  const completeLocales = LOCALES.filter((l) => {
    const title = (input.title as Record<string, unknown>)[l];
    if (typeof title !== "string" || title.trim() === "") return false;
    return blocks.length > 0 && blocks.every((b) =>
      b.result.ok && (b.result.value.content as Record<string, unknown>)[l] !== undefined);
  });
  for (const l of LOCALES) {
    if (!completeLocales.includes(l)) issues.push(issue("locale_missing", "warning", [l], `version is not complete in ${l}`));
  }
  return { blocks, completeLocales, issues };
}
