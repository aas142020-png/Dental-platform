import type { Issue } from "@dental/content-schema";

/**
 * Every API failure surfaces as ApiError. Clients branch on `kind` (and `reason` for
 * workflow rules), and translate them; `message` is the raw server text, for logs.
 */
export type ApiErrorKind =
  | "unauthenticated"  // no session / session expired
  | "forbidden"        // signed in but lacks the role or RLS denies
  | "not_found"
  | "conflict"         // unique / foreign-key collision
  | "invalid_input"    // malformed arguments or DB check constraint
  | "workflow_rule"    // an editorial rule blocked the action (see reason)
  | "content_invalid"  // content failed schema validation (client-side, before any write)
  | "network"
  | "unknown";

/**
 * Stable, machine-readable failure reasons. Raised by the database in HINT as 'reason:<code>'
 * (see the contract comment at the top of migration 0008). Messages may change; these may not.
 */
export const WORKFLOW_REASONS = [
  "sign_in_required", "role_required", "four_eyes", "transition_not_allowed", "note_required",
  "no_blocks", "no_claims", "claims_unverified", "media_not_ready", "locales_incomplete",
  "no_locale_complete", "embeds_unpublished", "embedded_live", "version_in_progress", "locked",
  "block_list_mismatch", "not_found", "invalid_entity_type", "topic_unavailable",
] as const;
export type WorkflowReason = (typeof WORKFLOW_REASONS)[number];

/** Which ApiError kind each reason implies. Exhaustive: adding a reason forces a decision here. */
export const REASON_KIND: Record<WorkflowReason, ApiErrorKind> = {
  sign_in_required: "unauthenticated",
  role_required: "forbidden",
  four_eyes: "forbidden",
  topic_unavailable: "forbidden",
  not_found: "not_found",
  invalid_entity_type: "invalid_input",
  transition_not_allowed: "workflow_rule",
  note_required: "workflow_rule",
  no_blocks: "workflow_rule",
  no_claims: "workflow_rule",
  claims_unverified: "workflow_rule",
  media_not_ready: "workflow_rule",
  locales_incomplete: "workflow_rule",
  no_locale_complete: "workflow_rule",
  embeds_unpublished: "workflow_rule",
  embedded_live: "workflow_rule",
  version_in_progress: "workflow_rule",
  locked: "workflow_rule",
  block_list_mismatch: "workflow_rule",
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly reason?: WorkflowReason;
  readonly code?: string;
  readonly details?: string;
  readonly issues?: Issue[];
  constructor(init: { kind: ApiErrorKind; message: string; reason?: WorkflowReason; code?: string; details?: string; issues?: Issue[] }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.reason = init.reason;
    this.code = init.code;
    this.details = init.details;
    this.issues = init.issues;
  }
}

const REASON_HINT = /^reason:([a-z_]+)$/;
const isReason = (r: string): r is WorkflowReason => (WORKFLOW_REASONS as readonly string[]).includes(r);

/** Read the stable reason from an error's HINT. Unknown or absent -> undefined (never guessed from the message). */
export function reasonFromHint(hint: string | null | undefined): WorkflowReason | undefined {
  const m = hint ? REASON_HINT.exec(hint.trim()) : null;
  return m && isReason(m[1]!) ? m[1] : undefined;
}

const BY_CODE: Record<string, ApiErrorKind> = {
  "42501": "forbidden",
  P0001: "workflow_rule",
  P0002: "not_found",
  PT404: "not_found", // PostgREST maps PTxyz to HTTP xyz
  PGRST116: "not_found",
  "23505": "conflict",
  "23503": "conflict",
  "23514": "invalid_input",
  "23502": "invalid_input",
  "22P02": "invalid_input",
  "22023": "invalid_input",
  "22007": "invalid_input",
  PGRST301: "unauthenticated",
  PGRST302: "unauthenticated",
  PGRST202: "invalid_input", // RPC not found / wrong argument names
};

export interface PostgrestLikeError { message: string; code?: string; details?: string | null; detail?: string | null; hint?: string | null }

/**
 * Normalise any failure (supabase-js PostgrestError, node-postgres DatabaseError, thrown Error)
 * into ApiError. Both PostgREST and node-postgres expose HINT as `hint`.
 */
export function toApiError(err: PostgrestLikeError | Error | unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = (err ?? {}) as PostgrestLikeError;
  const message = e.message ?? String(err);
  const code = e.code || undefined;
  const reason = reasonFromHint(e.hint);

  // Reason (stable contract) first, then SQLSTATE / PostgREST code, then transport heuristics.
  let kind: ApiErrorKind;
  if (reason) kind = REASON_KIND[reason];
  else if (code && BY_CODE[code]) kind = BY_CODE[code];
  else if (!code && /fetch failed|Failed to fetch|NetworkError|network request failed/i.test(message)) kind = "network";
  else kind = "unknown";

  return new ApiError({ kind, message, reason, code, details: e.details ?? e.detail ?? undefined });
}

/** Unwrap a supabase-js response: return data or throw ApiError. For queries that always return data on success. */
type Res = { data: unknown; error: PostgrestLikeError | null };

export function unwrap<R extends Res>(res: R): NonNullable<R["data"]> {
  if (res.error) throw toApiError(res.error);
  if (res.data === null || res.data === undefined) throw new ApiError({ kind: "not_found", message: "no data returned" });
  return res.data as NonNullable<R["data"]>;
}

/** Like unwrap, but "no row" is a normal outcome (maybeSingle, nullable RPC results). */
export function unwrapMaybe<R extends Res>(res: R): NonNullable<R["data"]> | null {
  if (res.error) throw toApiError(res.error);
  return (res.data ?? null) as NonNullable<R["data"]> | null;
}
