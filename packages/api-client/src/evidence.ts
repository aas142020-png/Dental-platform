import { z } from "zod";
import type { Tables } from "@dental/db-types";
import type { DentalClient } from "./client";
import { ApiError, unwrap, unwrapMaybe } from "./errors";

/* Staff: sources, claims, exact passages, and the source-impact review queue. */

const validate = <T extends z.ZodType>(schema: T, input: unknown, what: string): z.output<T> => {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new ApiError({ kind: "invalid_input", message: `invalid ${what}`,
      issues: r.error.issues.map((i) => ({ code: "invalid_shape", severity: "error", path: i.path as (string | number)[], message: i.message })) });
  }
  return r.data;
};

export const SourceInput = z.strictObject({
  title: z.string().trim().min(1),
  organization: z.string().trim().min(1).nullable().optional(),
  authors: z.string().trim().min(1).nullable().optional(),
  url: z.url().nullable().optional(),
  doi: z.string().regex(/^10\.\d{4,9}\/\S+$/, "DOI like 10.xxxx/yyyy").nullable().optional(),
  publication_date: z.iso.date().nullable().optional(),
  version_label: z.string().trim().min(1).nullable().optional(),
  evidence_type: z.enum(["clinical_guideline", "systematic_review", "meta_analysis", "rct", "cohort",
    "case_control", "case_series", "expert_consensus", "position_statement", "textbook", "narrative_review", "other"]),
  status: z.enum(["active", "under_review", "superseded", "retracted"]).optional(),
  last_reviewed_at: z.iso.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type SourceInput = z.infer<typeof SourceInput>;

export async function createSource(c: DentalClient, input: SourceInput) {
  const row = validate(SourceInput, input, "source");
  return unwrap(await c.from("sources").insert(row).select("*").single());
}
export async function updateSource(c: DentalClient, sourceId: string, patch: Partial<SourceInput>) {
  const row = validate(SourceInput.partial(), patch, "source");
  return unwrap(await c.from("sources").update(row).eq("id", sourceId).select("*").single());
}

const Statement = z.strictObject({ ar: z.string().trim().min(1).optional(), en: z.string().trim().min(1).optional() })
  .refine((s) => s.ar || s.en, "statement needs at least one language");

export async function createClaim(c: DentalClient, statement: { ar?: string; en?: string }, specialtyId?: string) {
  const s = validate(Statement, statement, "claim statement");
  return unwrap(await c.from("claims").insert({ statement: s, specialty_id: specialtyId ?? null }).select("*").single());
}

/** Link a claim to a block. anchor "" = applies to the whole block (no marker needed). */
export async function linkClaimToBlock(c: DentalClient, blockId: string, claimId: string, anchor = "") {
  validate(z.union([z.literal(""), z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/)]), anchor, "claim anchor");
  unwrapMaybe(await c.from("block_claims").upsert({ block_id: blockId, claim_id: claimId, anchor }));
}
export async function unlinkClaimFromBlock(c: DentalClient, blockId: string, claimId: string) {
  unwrapMaybe(await c.from("block_claims").delete().match({ block_id: blockId, claim_id: claimId }));
}
export async function linkClaimToQuestionVersion(c: DentalClient, versionId: string, claimId: string) {
  unwrapMaybe(await c.from("question_version_claims").upsert({ question_version_id: versionId, claim_id: claimId }));
}
export async function linkClaimToCaseVersion(c: DentalClient, versionId: string, claimId: string) {
  unwrapMaybe(await c.from("case_version_claims").upsert({ case_version_id: versionId, claim_id: claimId }));
}

export const PassageInput = z.strictObject({
  claimId: z.guid(), sourceId: z.guid(),
  locator: z.string().trim().min(1),
  passage: z.string().trim().min(1),
  support: z.enum(["direct", "partial", "contextual"]).default("direct"),
});

/** Attach an exact supporting passage. It starts unverified. */
export async function addClaimSource(c: DentalClient, input: z.input<typeof PassageInput>) {
  const p = validate(PassageInput, input, "passage");
  return unwrap(await c.from("claim_sources").insert({
    claim_id: p.claimId, source_id: p.sourceId, locator: p.locator, supporting_passage: p.passage, support: p.support,
  }).select("*").single());
}

/** Source verifier confirms the passage. The DB stamps verifier and time from the session. */
export async function verifyClaimSource(c: DentalClient, key: { claimId: string; sourceId: string; locator: string }) {
  return unwrap(await c.from("claim_sources").update({ verified_at: new Date().toISOString() })
    .match({ claim_id: key.claimId, source_id: key.sourceId, locator: key.locator }).select("*").single());
}

/* ---------- Source impact review ---------- */

export type Severity = "critical" | "high" | "low";

/** Detail rows: source -> claim -> published content, worst first. */
export async function listSourceImpact(c: DentalClient, filter: { severity?: Severity; sourceId?: string } = {}) {
  let q = c.from("v_source_impact").select("*");
  if (filter.severity) q = q.eq("severity", filter.severity);
  if (filter.sourceId) q = q.eq("source_id", filter.sourceId);
  return unwrap(await q.order("severity_rank").order("source_title"));
}

/** One row per flagged source with its worst severity. */
export async function listFlaggedSources(c: DentalClient) {
  return unwrap(await c.from("v_flagged_sources").select("*").order("worst_severity_rank").order("source_title"));
}

export type SourceRow = Tables<"sources">;
