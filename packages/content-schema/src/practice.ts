import { z } from "zod";
import { LocalId, LocalizedString, NonEmpty } from "./primitives";
import { RichTextPlain } from "./rich-text";
import { issue, toResult, type Issue, type Result } from "./issues";

/**
 * Question version content (columns of question_versions).
 * stem / explanation / option text are plain strings per locale: the DB completeness
 * check reads them as text. Claims attach to the version (question_version_claims).
 */
export const QuestionOption = z.strictObject({
  id: LocalId,
  text: LocalizedString,
  correct: z.boolean(),
});

export const QuestionContent = z.strictObject({
  kind: z.enum(["single_choice", "multi_choice", "true_false"]),
  stem: LocalizedString,
  options: z.array(QuestionOption).min(2).max(8),
  explanation: LocalizedString.default({}),
  difficulty: z.number().int().min(1).max(5).nullable().default(null),
});
export type QuestionContent = z.infer<typeof QuestionContent>;

/**
 * Case version content (case_versions.content). Stages are revealed one at a time.
 * No claim markers inside stages; no media in Sprint 1 (the DB media scanner covers topic blocks only).
 */
export const CaseStage = z.strictObject({
  id: LocalId,
  title: NonEmpty.optional(),
  prompt: RichTextPlain,
  reveal: RichTextPlain,
});
export const CaseLocale = z.strictObject({ stages: z.array(CaseStage).min(1).max(12) });
export const CaseContent = z.strictObject({
  ar: CaseLocale.optional(),
  en: CaseLocale.optional(),
  shared: z.strictObject({}).default({}),
});
export type CaseContent = z.infer<typeof CaseContent>;

const zodIssues = (err: z.ZodError): Issue[] =>
  err.issues.map((i) => issue("invalid_shape", "error", i.path as (string | number)[], i.message));

export function parseQuestion(input: unknown): Result<QuestionContent> {
  const r = QuestionContent.safeParse(input);
  if (!r.success) return { ok: false, issues: zodIssues(r.error) };
  const q = r.data;
  const issues: Issue[] = [];
  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    issues.push(issue("question_option_ids", "error", ["options"], "option ids must be unique"));
  }
  const correct = q.options.filter((o) => o.correct).length;
  if (q.kind === "single_choice" && correct !== 1) {
    issues.push(issue("question_correct_count", "error", ["options"], "single_choice needs exactly one correct option"));
  }
  if (q.kind === "multi_choice" && correct < 1) {
    issues.push(issue("question_correct_count", "error", ["options"], "multi_choice needs at least one correct option"));
  }
  if (q.kind === "true_false" && (q.options.length !== 2 || correct !== 1)) {
    issues.push(issue("question_correct_count", "error", ["options"], "true_false needs two options, one correct"));
  }
  return toResult(q, issues);
}

export function parseCase(input: unknown): Result<CaseContent> {
  const r = CaseContent.safeParse(input);
  if (!r.success) return { ok: false, issues: zodIssues(r.error) };
  const c = r.data;
  const issues: Issue[] = [];
  const stageIds = (l?: { stages: { id: string }[] }) => l?.stages.map((s) => s.id) ?? [];
  for (const loc of ["ar", "en"] as const) {
    const ids = stageIds(c[loc]);
    if (new Set(ids).size !== ids.length) issues.push(issue("duplicate_ids", "error", [loc, "stages"], "stage ids must be unique"));
  }
  if (c.ar && c.en && stageIds(c.ar).join() !== stageIds(c.en).join()) {
    issues.push(issue("locale_structure_mismatch", "warning", ["stages"], "ar and en stages differ"));
  }
  return toResult(c, issues);
}
