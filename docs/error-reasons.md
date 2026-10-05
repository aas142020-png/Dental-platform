# Error reason contract

## Design

Every application-relevant `RAISE` in the migrations carries a machine-readable reason in PostgreSQL's `HINT` field:

```sql
raise exception using errcode = 'P0001',
  message = format('%s of %s claims lack a verified link to an active source', v_unverified, v_total),
  hint = 'reason:claims_unverified';
```

- **Transport.** PostgREST returns `hint` in every error response (`{ code, message, details, hint }`); node-postgres exposes it as `err.hint`. Nothing Supabase-specific is needed.
- **Format.** `reason:<snake_case_code>`. The prefix keeps it separate from ordinary Postgres hints, which the client ignores.
- **Stability.** Reason codes are an API contract. Messages are human text and may be reworded or translated without breaking clients.
- **Client.** `toApiError()` reads `hint` → `reason` → `kind` via an exhaustive table. When there's no hint (RLS denials, constraint violations, network failures), it falls back to SQLSTATE/PostgREST codes. Message text is never parsed.
- **Forward compatibility.** An unknown `reason:` from a newer server gives `reason: undefined`, and `kind` falls back to SQLSTATE.

| Reason | ApiError kind | Raised when |
| --- | --- | --- |
| `sign_in_required` | unauthenticated | No session for a workflow call or progress write |
| `role_required` | forbidden | Missing staff role for the step, verification or media review |
| `four_eyes` | forbidden | Author attempting a review step while the policy is on |
| `topic_unavailable` | forbidden | Progress recorded on a topic the caller can't read |
| `not_found` | not_found | Version id doesn't exist |
| `invalid_entity_type` | invalid_input | Unknown entity type passed to `transition_content` |
| `transition_not_allowed` | workflow_rule | Move not in `workflow_transitions` |
| `note_required` | workflow_rule | Return-to-draft / archive without a reason |
| `no_blocks` | workflow_rule | Source verification of an empty version |
| `no_claims` | workflow_rule | No linked claims (policy) |
| `claims_unverified` | workflow_rule | A claim lacks a verified link to an active source |
| `media_not_ready` | workflow_rule | Referenced media missing, unapproved, or without required alt text |
| `locales_incomplete` | workflow_rule | A required publish locale is incomplete |
| `no_locale_complete` | workflow_rule | No locale is complete |
| `embeds_unpublished` | workflow_rule | Topic embeds a question/case with no live version |
| `embedded_live` | workflow_rule | Unpublishing a question/case used by a live topic |
| `version_in_progress` | workflow_rule | Second draft while one is open |
| `locked` | workflow_rule | Any write to non-draft content, in-use claims/sources/media, or workflow-only fields |
| `block_list_mismatch` | workflow_rule | Reorder list doesn't match the version's blocks |

## Guards

- **Migration scan** (`api-client/test/errors.test.ts`):
  - Every `raise exception` statement must carry `hint = 'reason:<code>'` with a code the client knows.
  - Every client code must be raised somewhere, so there are no dead codes.
  - The contract comment in migration 0008 must list exactly the client's codes.
- **Database** (`supabase/tests/05_error_reasons.test.sql`): real failures are triggered and their HINT is read with `GET STACKED DIAGNOSTICS`. This covers 10 reasons, plus a check that RLS denials carry no reason.
- **Driver round-trip** (`api-client/test/db-roundtrip.test.ts`): real errors through node-postgres map to the right kind and reason.
