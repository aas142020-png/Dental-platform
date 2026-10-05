import { describe, expect, it } from "vitest";
import { exampleCase, exampleQuestion, examples, parseCase, parseQuestion, validateVersion } from "../src";

const clone = <T>(v: T): T => structuredClone(v);
const codes = (issues: { severity: string; code: string }[]) => issues.map((i) => `${i.severity}:${i.code}`);

describe("questions", () => {
  it("example is valid", () => expect(parseQuestion(exampleQuestion)).toMatchObject({ ok: true, issues: [] }));
  it("single_choice needs exactly one correct option", () => {
    const q = clone(exampleQuestion); q.options[1]!.correct = true;
    expect(codes(parseQuestion(q).issues)).toEqual(["error:question_correct_count"]);
  });
  it("true_false needs two options", () => {
    const q = { ...clone(exampleQuestion), kind: "true_false" };
    expect(codes(parseQuestion(q).issues)).toEqual(["error:question_correct_count"]);
  });
  it("option ids must be unique", () => {
    const q = clone(exampleQuestion); q.options[2]!.id = "a";
    expect(codes(parseQuestion(q).issues)).toContain("error:question_option_ids");
  });
});

describe("cases", () => {
  it("example is valid", () => expect(parseCase(exampleCase)).toMatchObject({ ok: true, issues: [] }));
  it("claim markers are not allowed inside case stages", () => {
    const c = clone(exampleCase) as any;
    c.en.stages[0].prompt[0].children.push({ type: "claim", anchor: "c1" });
    expect(parseCase(c).ok).toBe(false);
  });
  it("stage structure differing between locales is a warning", () => {
    const c = clone(exampleCase); c.ar.stages.pop();
    const r = parseCase(c);
    expect(r.ok).toBe(true);
    expect(codes(r.issues)).toEqual(["warning:locale_structure_mismatch"]);
  });
});

describe("validateVersion", () => {
  const blocks = Object.values(examples);
  const title = { ar: "عنوان", en: "Title" };

  it("all examples together are complete in both locales", () => {
    const r = validateVersion({ title, blocks });
    expect(r.completeLocales).toEqual(["ar", "en"]);
    expect(r.issues).toEqual([]);
  });
  it("a locale missing from one block makes that locale incomplete", () => {
    const bs = clone(blocks); delete (bs[1]!.content as any).en;
    const r = validateVersion({ title, blocks: bs });
    expect(r.completeLocales).toEqual(["ar"]);
    expect(codes(r.issues)).toEqual(["warning:locale_missing"]);
  });
  it("one invalid block makes no locale complete", () => {
    const bs = clone(blocks); (bs[0]!.content as any).en.points = [];
    expect(validateVersion({ title, blocks: bs }).completeLocales).toEqual([]);
  });
  it("blank title in a locale makes it incomplete", () => {
    expect(validateVersion({ title: { ar: "عنوان", en: " " }, blocks }).completeLocales).toEqual(["ar"]);
  });
  it("blocks are reported in position order", () => {
    const r = validateVersion({ title, blocks: [...blocks].reverse() });
    expect(r.blocks.map((b) => b.id)).toEqual(blocks.map((b) => b.id));
  });
});
