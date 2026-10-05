import { describe, expect, it } from "vitest";
import { EXAMPLE_IDS, collectAssetIds, collectClaimAnchors, examples, toPlainText } from "../src";

describe("collectAssetIds (mirror of the DB scanner)", () => {
  it("finds every asset_id across all examples, including nested poster refs", () => {
    const all = new Set<string>();
    for (const b of Object.values(examples)) collectAssetIds(b.content, all);
    expect([...all].sort()).toEqual([
      EXAMPLE_IDS.imageAsset, EXAMPLE_IDS.animationAsset, EXAMPLE_IDS.posterAsset, EXAMPLE_IDS.diagramAsset,
    ].sort());
  });
  it("ignores other key names and non-uuid values", () => {
    const ids = collectAssetIds({ image_id: EXAMPLE_IDS.imageAsset, x: { asset_id: "not-a-uuid" } });
    expect(ids.size).toBe(0);
  });
  it("searches arrays and any depth, case-insensitive, de-duplicated", () => {
    const up = EXAMPLE_IDS.imageAsset.toUpperCase();
    const ids = collectAssetIds([{ a: [{ asset_id: up }] }, { asset_id: EXAMPLE_IDS.imageAsset }]);
    expect([...ids]).toEqual([EXAMPLE_IDS.imageAsset]);
  });
  it("does not treat question/case/source ids as media", () => {
    const ids = collectAssetIds([examples.quiz.content, examples.clinical_case.content]);
    expect(ids.size).toBe(0);
  });
});

describe("rich text helpers", () => {
  it("collects claim anchors from nested rich text", () => {
    expect(collectClaimAnchors((examples.text.content as any).en)).toEqual(["c1", "c2"]);
  });
  it("produces plain text for previews and search", () => {
    const body = (examples.text.content as any).en.body;
    expect(toPlainText(body)).toBe("Placeholder paragraph with bold text and an evidenced statement.\nFirst item\nSecond item");
  });
});
