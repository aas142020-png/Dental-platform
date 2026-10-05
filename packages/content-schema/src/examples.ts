/**
 * Representative, schema-valid examples for every block type, plus a question and a case.
 * PLACEHOLDER TEXT ONLY — no clinical content. Used by tests, docs, the CMS block palette,
 * and the DB round-trip fixture. Ids are fixed so fixtures are reproducible.
 */
import type { BlockType } from "./blocks";
import type { RawBlock } from "./validate";

const t = (text: string) => ({ type: "text" as const, text });
const b = (text: string) => ({ type: "text" as const, text, marks: ["bold" as const] });
const claim = (anchor: string) => ({ type: "claim" as const, anchor });
const p = (...children: object[]) => ({ type: "paragraph" as const, children });

export const EXAMPLE_IDS = {
  claimA: "11111111-1111-4111-8111-111111111111",
  claimB: "22222222-2222-4222-8222-222222222222",
  imageAsset: "a0000000-0000-4000-8000-000000000001",
  animationAsset: "a0000000-0000-4000-8000-000000000002",
  posterAsset: "a0000000-0000-4000-8000-000000000003",
  diagramAsset: "a0000000-0000-4000-8000-000000000004",
  question: "c0000000-0000-4000-8000-000000000001",
  case: "c0000000-0000-4000-8000-000000000002",
  source: "50000000-0000-4000-8000-000000000001",
} as const;

const id = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const examples: Record<BlockType, RawBlock> = {
  summary: {
    id: id(1), position: 0, type: "summary", schema_version: 1,
    content: {
      ar: { heading: "النقاط الرئيسية", points: [[t("النقطة الأولى (نص تجريبي)"), claim("c1")], [t("النقطة الثانية")]] },
      en: { heading: "Key points", points: [[t("First point (placeholder)"), claim("c1")], [t("Second point")]] },
      shared: {},
    },
    claims: [{ claim_id: EXAMPLE_IDS.claimA, anchor: "c1" }],
  },

  text: {
    id: id(2), position: 1, type: "text", schema_version: 1,
    content: {
      ar: { heading: "عنوان القسم", body: [
        p(t("فقرة تجريبية مع "), b("نص عريض"), t(" وادعاء موثق"), claim("c1"), t(".")),
        { type: "list", ordered: true, items: [[t("عنصر أول")], [t("عنصر ثانٍ"), claim("c2")]] },
      ] },
      en: { heading: "Section heading", body: [
        p(t("Placeholder paragraph with "), b("bold text"), t(" and an evidenced statement"), claim("c1"), t(".")),
        { type: "list", ordered: true, items: [[t("First item")], [t("Second item"), claim("c2")]] },
      ] },
      shared: {},
    },
    claims: [
      { claim_id: EXAMPLE_IDS.claimA, anchor: "c1" },
      { claim_id: EXAMPLE_IDS.claimB, anchor: "c2" },
    ],
  },

  illustration: {
    id: id(3), position: 2, type: "illustration", schema_version: 1,
    content: {
      ar: { caption: [t("تعليق الصورة")] },
      en: { caption: [t("Image caption")] },
      shared: { image: { asset_id: EXAMPLE_IDS.imageAsset }, aspect: "4:3", zoomable: true },
    },
    claims: [],
  },

  animation: {
    id: id(4), position: 3, type: "animation", schema_version: 1,
    content: {
      ar: { caption: [t("تعليق الحركة")], step_labels: ["الخطوة 1", "الخطوة 2", "الخطوة 3"] },
      en: { caption: [t("Animation caption")], step_labels: ["Step 1", "Step 2", "Step 3"] },
      shared: {
        media: { asset_id: EXAMPLE_IDS.animationAsset },
        poster: { asset_id: EXAMPLE_IDS.posterAsset },
        loop: false,
      },
    },
    claims: [],
  },

  interactive_diagram: {
    id: id(5), position: 4, type: "interactive_diagram", schema_version: 1,
    content: {
      ar: { caption: [t("مخطط تجريبي")], hotspots: [
        { id: "h1", label: "المنطقة أ" },
        { id: "h2", label: "المنطقة ب", description: [p(t("وصف تجريبي"))] },
      ] },
      en: { caption: [t("Placeholder diagram")], hotspots: [
        { id: "h1", label: "Region A" },
        { id: "h2", label: "Region B", description: [p(t("Placeholder description"))] },
      ] },
      shared: {
        image: { asset_id: EXAMPLE_IDS.diagramAsset },
        hotspots: [{ id: "h1", x: 0.25, y: 0.4 }, { id: "h2", x: 0.7, y: 0.55 }],
      },
    },
    claims: [],
  },

  comparison: {
    id: id(6), position: 5, type: "comparison", schema_version: 1,
    content: {
      ar: { title: "مقارنة", columns: ["الخيار أ", "الخيار ب"], rows: [
        { label: "الخاصية 1", cells: [[t("قيمة")], [t("قيمة"), claim("c1")]] },
        { label: "الخاصية 2", cells: [[t("قيمة")], [t("قيمة")]] },
      ] },
      en: { title: "Comparison", columns: ["Option A", "Option B"], rows: [
        { label: "Attribute 1", cells: [[t("Value")], [t("Value"), claim("c1")]] },
        { label: "Attribute 2", cells: [[t("Value")], [t("Value")]] },
      ] },
      shared: {},
    },
    claims: [{ claim_id: EXAMPLE_IDS.claimA, anchor: "c1" }],
  },

  clinical_pearl: {
    id: id(7), position: 6, type: "clinical_pearl", schema_version: 1,
    content: {
      ar: { title: "نصيحة", body: [p(t("نص تجريبي للنصيحة"), claim("c1"))] },
      en: { title: "Pearl", body: [p(t("Placeholder pearl text"), claim("c1"))] },
      shared: {},
    },
    claims: [{ claim_id: EXAMPLE_IDS.claimA, anchor: "c1" }],
  },

  warning: {
    id: id(8), position: 7, type: "warning", schema_version: 1,
    content: {
      ar: { title: "تنبيه", body: [p(t("نص تحذير تجريبي"))] },
      en: { title: "Caution", body: [p(t("Placeholder warning text"))] },
      shared: { severity: "caution" },
    },
    // Block-level claim: empty anchor, no marker needed.
    claims: [{ claim_id: EXAMPLE_IDS.claimB, anchor: "" }],
  },

  clinical_case: {
    id: id(9), position: 8, type: "clinical_case", schema_version: 1,
    content: { ar: { heading: "حالة" }, en: { heading: "Case" }, shared: { case_id: EXAMPLE_IDS.case } },
    claims: [],
  },

  quiz: {
    id: id(10), position: 9, type: "quiz", schema_version: 1,
    content: { ar: {}, en: { heading: "Check yourself" }, shared: { question_ids: [EXAMPLE_IDS.question] } },
    claims: [],
  },

  source_list: {
    id: id(11), position: 10, type: "source_list", schema_version: 1,
    content: { ar: { heading: "المصادر" }, en: { heading: "Sources" }, shared: { mode: "auto" } },
    claims: [],
  },
};

/** question_versions columns */
export const exampleQuestion = {
  kind: "single_choice",
  stem: { ar: "سؤال تجريبي؟", en: "Placeholder question?" },
  options: [
    { id: "a", text: { ar: "الخيار أ", en: "Option A" }, correct: true },
    { id: "b", text: { ar: "الخيار ب", en: "Option B" }, correct: false },
    { id: "c", text: { ar: "الخيار ج", en: "Option C" }, correct: false },
  ],
  explanation: { ar: "شرح تجريبي", en: "Placeholder explanation" },
  difficulty: 2,
};

/** case_versions.content */
export const exampleCase = {
  ar: { stages: [
    { id: "s1", title: "العرض", prompt: [p(t("نص المرحلة الأولى"))], reveal: [p(t("الكشف الأول"))] },
    { id: "s2", prompt: [p(t("نص المرحلة الثانية"))], reveal: [p(t("الكشف الثاني"))] },
  ] },
  en: { stages: [
    { id: "s1", title: "Presentation", prompt: [p(t("Stage one text"))], reveal: [p(t("First reveal"))] },
    { id: "s2", prompt: [p(t("Stage two text"))], reveal: [p(t("Second reveal"))] },
  ] },
  shared: {},
};
