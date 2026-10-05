import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, EXAMPLE_IDS } from "@dental/content-schema";
import { ApiError, mediaFor, parseTopicBundle } from "../src";
import { exampleBundleJson } from "./helpers";

describe("parseTopicBundle", () => {
  it("parses every block type, embeds and media from a bundle", () => {
    const b = parseTopicBundle(exampleBundleJson());
    expect(b.blocks.map((x) => x.type)).toEqual([...BLOCK_TYPES]);
    expect(b.hidden).toEqual([]);
    expect(b.warnings).toEqual([]);
    expect(b.questions[EXAMPLE_IDS.question]?.versionNo).toBe(2);
    expect(b.cases[EXAMPLE_IDS.case]?.content.en?.stages).toHaveLength(2);
  });

  it("hides an invalid block and still renders the rest", () => {
    const raw = exampleBundleJson();
    raw.blocks[0].content.en.points = [];
    const b = parseTopicBundle(raw);
    expect(b.blocks).toHaveLength(10);
    expect(b.hidden).toEqual([expect.objectContaining({ kind: "block", type: "summary" })]);
  });

  it("hides a block written by a newer schema version than this client knows", () => {
    const raw = exampleBundleJson();
    raw.blocks[1].schema_version = 9;
    const b = parseTopicBundle(raw);
    expect(b.hidden[0]?.issues[0]?.code).toBe("unsupported_schema_version");
  });

  it("hides an embedded question with invalid content", () => {
    const raw = exampleBundleJson();
    raw.questions[EXAMPLE_IDS.question].options[1].correct = true; // two correct in single_choice
    const b = parseTopicBundle(raw);
    expect(b.questions[EXAMPLE_IDS.question]).toBeUndefined();
    expect(b.hidden).toEqual([expect.objectContaining({ kind: "question", id: EXAMPLE_IDS.question })]);
  });

  it("locked topic: listed, not readable, no blocks", () => {
    const raw = { ...exampleBundleJson(), can_read: false, blocks: [], claims: {}, sources: {}, questions: {}, cases: {}, media: {} };
    const b = parseTopicBundle(raw);
    expect(b.canRead).toBe(false);
    expect(b.blocks).toEqual([]);
  });

  it("tolerates extra envelope fields added by a newer server", () => {
    const raw = { ...exampleBundleJson(), new_field: 1 };
    expect(() => parseTopicBundle(raw)).not.toThrow();
  });

  it("rejects a malformed envelope with content_invalid", () => {
    const raw = exampleBundleJson(); delete raw.version;
    expect(() => parseTopicBundle(raw)).toThrowError(ApiError);
    try { parseTopicBundle(raw); } catch (e) { expect((e as ApiError).kind).toBe("content_invalid"); }
  });

  it("resolves media references by asset_id", () => {
    const b = parseTopicBundle(exampleBundleJson());
    const ill = b.blocks.find((x) => x.type === "illustration");
    expect(ill?.type === "illustration" && mediaFor(b, ill.content.shared.image)?.kind).toBe("image");
  });
});
