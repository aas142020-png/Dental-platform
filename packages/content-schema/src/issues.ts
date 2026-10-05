/**
 * Validation never throws. Every check returns issues with a stable `code`
 * (clients translate codes; `message` is for developers and logs).
 *
 * severity:
 *   error    content cannot be rendered or published as-is (renderer hides the block)
 *   warning  editorial hint shown in the CMS; never blocks rendering
 */
export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "invalid_shape"
  | "unknown_block_type"
  | "unsupported_schema_version"
  | "locale_missing"
  | "locale_structure_mismatch"
  | "claim_anchor_unlinked"
  | "claim_link_unused"
  | "clinical_block_without_claims"
  | "hotspot_mismatch"
  | "comparison_cell_count"
  | "question_correct_count"
  | "question_option_ids"
  | "duplicate_ids";

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Path inside the content, e.g. ["en", "rows", 2, "cells"]. */
  path: (string | number)[];
  message: string;
}

export type Result<T> =
  | { ok: true; value: T; issues: Issue[] }      // issues contains warnings only
  | { ok: false; value?: undefined; issues: Issue[] }; // at least one error

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === "error");

export function toResult<T>(value: T | undefined, issues: Issue[]): Result<T> {
  return hasErrors(issues) || value === undefined
    ? { ok: false, issues }
    : { ok: true, value, issues };
}

export const issue = (
  code: IssueCode,
  severity: IssueSeverity,
  path: (string | number)[],
  message: string,
): Issue => ({ code, severity, path, message });
