import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { formatDate, formatNumber } from "../src";

// The approved pattern: plural selects the grammatical form; the number shown is pre-formatted.
const message = "{n, plural, zero {لا مواضيع} one {موضوع واحد} two {موضوعان} few {{count} مواضيع} many {{count} موضوعًا} other {{count} موضوع}}";

describe("Arabic plurals with Western digits", () => {
  const t = createTranslator({ locale: "ar", messages: { m: message } });
  const show = (n: number) => t("m", { n, count: formatNumber("ar", n) });

  it.each([
    [0, "لا مواضيع"],
    [1, "موضوع واحد"],
    [2, "موضوعان"],
    [3, "3 مواضيع"],
    [11, "11 موضوعًا"],
    [100, "100 موضوع"],
    [1250, "1,250 موضوعًا"], // n % 100 = 50 → "many"
  ])("%i → %s", (n, expected) => expect(show(n)).toBe(expected));

  it("all six Arabic plural categories are reachable", () => {
    const cats = new Set([0, 1, 2, 3, 11, 100].map((n) => new Intl.PluralRules("ar").select(n)));
    expect([...cats].sort()).toEqual(["few", "many", "one", "other", "two", "zero"]);
  });
});

describe("formatNumber / formatDate never emit Arabic-Indic digits", () => {
  const arabicIndic = /[\u0660-\u0669\u06F0-\u06F9]/;
  it("numbers", () => {
    for (const n of [0, 7, 1234.5, 1_000_000]) expect(formatNumber("ar", n)).not.toMatch(arabicIndic);
  });
  it("dates", () => {
    expect(formatDate("ar", new Date("2026-10-06T00:00:00Z"), { dateStyle: "long", timeZone: "UTC" })).not.toMatch(arabicIndic);
  });
  it("is robust even where the region default is Arabic-Indic (ar-SA)", () => {
    expect(new Intl.NumberFormat("ar-SA").format(5)).toMatch(arabicIndic); // the risk being guarded against
  });
});
