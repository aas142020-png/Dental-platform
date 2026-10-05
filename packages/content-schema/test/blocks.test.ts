import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES, CURRENT_SCHEMA_VERSION, examples, parseBlock, type RawBlock,
} from "../src";

const clone = <T>(v: T): T => structuredClone(v);
const codes = (r: ReturnType<typeof parseBlock>) => r.issues.map((i) => `${i.severity}:${i.code}`);
/** Example with its content modified by `mutate`. */
const variant = (type: keyof typeof examples, mutate: (c: any) => void, extra: Partial<RawBlock> = {}): RawBlock => {
  const b = clone(examples[type]);
  mutate(b.content);
  return { ...b, ...extra };
};

describe("examples", () => {
  it("covers all 11 block types", () => {
    expect(Object.keys(examples).sort()).toEqual([...BLOCK_TYPES].sort());
    expect(BLOCK_TYPES).toHaveLength(11);
  });

  it.each(BLOCK_TYPES)("%s example is valid with no issues", (type) => {
    const r = parseBlock(examples[type]);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.value?.type).toBe(type);
  });

  it("every type is at schema_version 1", () => {
    for (const t of BLOCK_TYPES) expect(CURRENT_SCHEMA_VERSION[t]).toBe(1);
  });
});

describe("registry", () => {
  it("rejects unknown block types", () => {
    expect(codes(parseBlock({ ...examples.text, type: "video" }))).toEqual(["error:unknown_block_type"]);
  });
  it("rejects schema versions this client does not know", () => {
    expect(codes(parseBlock({ ...examples.text, schema_version: 2 }))).toEqual(["error:unsupported_schema_version"]);
  });
  it("applies defaults", () => {
    const r = parseBlock(variant("illustration", (c) => { delete c.shared.aspect; delete c.shared.zoomable; }));
    expect(r.ok && r.value.type === "illustration" && r.value.content.shared).toMatchObject({ aspect: "auto", zoomable: true });
  });
});

describe("one failure case per block type", () => {
  const cases: [string, RawBlock, string][] = [
    ["summary: empty points", variant("summary", (c) => { c.en.points = []; }), "error:invalid_shape"],
    ["text: unknown key (strict objects)", variant("text", (c) => { c.en.subtitle = "x"; }), "error:invalid_shape"],
    ["text: HTML string instead of rich text", variant("text", (c) => { c.en.body = "<p>hi</p>"; }), "error:invalid_shape"],
    ["illustration: media ref without asset_id key", variant("illustration", (c) => { c.shared.image = { image_id: c.shared.image.asset_id }; }), "error:invalid_shape"],
    ["illustration: media ref in a locale payload", variant("illustration", (c) => { c.en.image = { asset_id: c.shared.image.asset_id }; }), "error:invalid_shape"],
    ["animation: poster as bare string", variant("animation", (c) => { c.shared.poster = c.shared.poster.asset_id; }), "error:invalid_shape"],
    ["interactive_diagram: hotspot out of range", variant("interactive_diagram", (c) => { c.shared.hotspots[0].x = 1.2; }), "error:invalid_shape"],
    ["interactive_diagram: unlabelled hotspot", variant("interactive_diagram", (c) => { c.ar.hotspots.pop(); }), "error:hotspot_mismatch"],
    ["comparison: row/column count mismatch", variant("comparison", (c) => { c.en.rows[1].cells.pop(); }), "error:comparison_cell_count"],
    ["clinical_pearl: empty body", variant("clinical_pearl", (c) => { c.en.body = []; }), "error:invalid_shape"],
    ["warning: unknown severity", variant("warning", (c) => { c.shared.severity = "info"; }), "error:invalid_shape"],
    ["clinical_case: case_id not an id", variant("clinical_case", (c) => { c.shared.case_id = "case-1"; }), "error:invalid_shape"],
    ["quiz: no questions", variant("quiz", (c) => { c.shared.question_ids = []; }), "error:invalid_shape"],
    ["source_list: manual without source_ids", variant("source_list", (c) => { c.shared = { mode: "manual" }; }), "error:invalid_shape"],
  ];
  it.each(cases)("%s", (_name, block, expected) => {
    const r = parseBlock(block);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain(expected);
  });
});

describe("cross-locale warnings", () => {
  it("comparison tables of different shape across locales", () => {
    const r = parseBlock(variant("comparison", (c) => { c.ar.rows.pop(); }));
    expect(r.ok).toBe(true);
    expect(codes(r)).toContain("warning:locale_structure_mismatch");
  });
  it("animation step labels differing in count", () => {
    const r = parseBlock(variant("animation", (c) => { c.ar.step_labels.pop(); }));
    expect(codes(r)).toEqual(["warning:locale_structure_mismatch"]);
  });
  it("a block with only one locale is valid (completeness is a separate check)", () => {
    const r = parseBlock(variant("text", (c) => { delete c.en; }));
    expect(r.ok).toBe(true);
  });
});

describe("claims", () => {
  it("marker with no linked claim is an error", () => {
    const r = parseBlock({ ...examples.text, claims: [{ claim_id: "11111111-1111-4111-8111-111111111111", anchor: "c1" }] });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("error:claim_anchor_unlinked");
  });
  it("linked anchor that the text never uses is a warning", () => {
    const r = parseBlock({ ...examples.text, claims: [...examples.text.claims!, { claim_id: "33333333-3333-4333-8333-333333333333", anchor: "c9" }] });
    expect(r.ok).toBe(true);
    expect(codes(r)).toEqual(["warning:claim_link_unused"]);
  });
  it("block-level claim (empty anchor) needs no marker", () => {
    expect(parseBlock(examples.warning).issues).toEqual([]);
  });
  it("clinical block types without claims get a warning", () => {
    const r = parseBlock({ ...examples.warning, claims: [] });
    expect(r.ok).toBe(true);
    expect(codes(r)).toEqual(["warning:clinical_block_without_claims"]);
  });
  it("markers that differ between ar and en are flagged", () => {
    const r = parseBlock(variant("clinical_pearl", (c) => { c.ar.body = [{ type: "paragraph", children: [{ type: "text", text: "بدون ادعاء" }] }]; }));
    expect(codes(r)).toContain("warning:locale_structure_mismatch");
  });
  it("claim checks are skipped when claims are not supplied", () => {
    const { claims: _omit, ...noClaims } = examples.text;
    expect(parseBlock(noClaims).issues).toEqual([]);
  });
});
