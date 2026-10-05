# Step 3 review: shared packages

Two packages, both platform-neutral (no React, no Next.js, no DOM), so a future native app imports them unchanged:

- `@dental/content-schema`: Zod schemas for the 11 block types, question and case content, rich text, validation.
- `@dental/api-client`: typed functions over Supabase (views, tables, RPCs), bundle parsing, error model.

`@dental/db-types` is now generated from the migrated schema: 27 tables, 5 views, 8 RPCs, 13 enums, no `unknown` types. No migration changed in this step.

## 1. Content-schema design

**Envelope.** Every block's `content` is `{ ar?, en?, shared }`, matching `topic_blocks.content`.

- Locale keys may be missing in drafts; whether a version is complete is a separate check.
- `shared` holds language-neutral data: ids, layout, and media references.
- All content objects are strict, so an unknown key or typo is an error, not silently kept.

**Media references.** Every reference is an object `{ "asset_id": "<uuid>" }`, placed only in `shared` under a descriptive name (`image`, `media`, `poster`). `asset_id` remains the only key the DB scanner reads. A test runs the DB scanner and `collectAssetIds()` on the same content and requires identical results.

**Rich text** is a JSON tree, not HTML or Markdown: paragraphs and lists of text nodes (bold/italic) and claim markers `{ type: "claim", anchor }`.

- Nothing to parse and nothing to inject; it renders the same on web and native.
- Claim markers resolve through `block_claims.anchor`. A claim linked with an empty anchor applies to the whole block and needs no marker.
- Case stages use a variant without claim markers, because case claims attach to the case version.

**Versioned schemas.** The registry maps `type → schema_version → schema`, and all 11 types are at v1. A client that meets a newer version hides that block rather than misrendering it.

| Type | Locale payload | Shared payload |
| --- | --- | --- |
| summary | heading?, points (1–10, rich inline) | — |
| text | heading?, body (rich text) | — |
| illustration | caption? | image {asset_id}, aspect, zoomable |
| animation | caption?, step_labels | media {asset_id}, poster? {asset_id}, loop |
| interactive_diagram | caption?, hotspots [{id, label, description?}] | image {asset_id}, poster?, hotspots [{id, x, y}] |
| comparison | title?, columns (2–6), rows [{label, cells}] | — |
| clinical_pearl | title?, body | — |
| warning | title, body | severity: caution / danger |
| clinical_case | heading? | case_id (identity id) |
| quiz | heading? | question_ids (identity ids, 1–10) |
| source_list | heading? | mode: auto, or manual + source_ids |

Full JSON for every type: `docs/block-examples.md`, generated from `examples.ts`.

## 2. Validation and error strategy

**Validation never throws.** It returns `Result` with issues. Each issue has a stable `code`, a `severity` and a `path`; clients translate the code, and the message is for logs.

| Severity | Effect |
| --- | --- |
| error | The block is hidden from learners and listed for staff. `saveBlock` refuses to send it. |
| warning | Shown in the CMS only. It never blocks rendering. |

Rules beyond field shapes:

- **Comparison tables:** the cell count must match the column count.
- **Diagrams:** hotspot labels must match the positioned hotspots.
- **Questions:** single-choice needs exactly one correct option, and true/false needs exactly two options.
- **Claim anchors:** a marker with no linked claim is an error.
- **Warnings only:**
  - A linked claim the text never uses.
  - A clinical block with no claims.
  - AR and EN differing in structure or claim markers.

`validateVersion()` reports which locales are complete *and* valid. It is stricter than the DB gate, which checks presence only. A test shows the two agree on presence.

**API errors.** Every failure becomes `ApiError { kind, reason?, code, issues? }`.

- `kind`: `unauthenticated | forbidden | not_found | conflict | invalid_input | workflow_rule | content_invalid | network | unknown`.
- `reason`, for workflow rules: `claims_unverified`, `locales_incomplete`, `four_eyes`, `embedded_live`, `locked`, `version_in_progress`, and so on.
- Reasons come from the DB's error messages. A test scans every `raise` in the migrations and fails if a message isn't classified, so a new DB message can't silently become `unknown`.

## 3. API-client surface

Every function takes the Supabase client as its first argument (no singleton). Returns are typed from the generated DB types.

| Area | Functions |
| --- | --- |
| Catalog (learners) | `listSpecialties`, `listTopics`, `getTopic` → parsed `TopicBundle`, `getSource` |
| Me | `getMyProfile`, `updateMyProfile` (validated, can complete onboarding), `setMyInterests`, `getMyStaffRoles`, `listMyProgress`, `recordProgress`, `listSaved`, `saveItem`, `unsaveItem` |
| Editorial (staff) | `listAdminTopics`, `getVersionBundle`, `createTopicDraft`, `createQuestionDraft`, `createCaseDraft`, `transition`, `listWorkflowEvents`, `saveBlock` (validates first), `deleteBlock`, `reorderBlocks`, `updateTopicVersionMeta`, `saveQuestionVersion`, `saveCaseVersion` |
| Traceability | `getVersionConsumers(kind, versionId)`, `getIdentityConsumers(kind, identityId)` |
| Evidence (staff) | `createSource`, `updateSource`, `createClaim`, `linkClaimToBlock`, `unlinkClaimFromBlock`, `linkClaimToQuestionVersion`, `linkClaimToCaseVersion`, `addClaimSource`, `verifyClaimSource`, `listSourceImpact`, `listFlaggedSources` |

**`TopicBundle`** returns:

- `blocks`: valid blocks only, typed by block type.
- `hidden`: invalid blocks and embeds, for staff.
- `warnings`.
- `questions` and `cases`, keyed by identity id and resolved to their live version.
- `claims`, `sources` and `media`, plus `canRead` and `availableLocales`.
- The envelope is lenient (a newer server may add fields); the content is strict.

**Traceability without new data.** The question "which published topics currently show question version X?" is answered from existing rows:

1. X is shown only if it is its question's `published_version_id`.
2. If so, it is shown by every published topic version whose blocks embed that question's id.

`getVersionConsumers` implements exactly this. "What did topic Y show on date D" comes from `workflow_events` timestamps; I did not build a helper for it.

## 4. Tests (229 total, all passing)

| Suite | Tests | Covers |
| --- | --- | --- |
| content-schema | 57 | All 11 examples valid; one failure per block type; registry and versions; defaults; claim-anchor rules; cross-locale warnings; question/case rules; version completeness; media scanner; rich-text helpers |
| api-client unit | 78 | Every DB error message classified; error kinds; bundle parsing (hidden blocks, unknown schema version, invalid embed, locked topic, newer server); request shaping with a recording fake client; `saveBlock` never sends invalid content; traceability logic |
| api-client ↔ Postgres | 6 | Examples stored in the real schema; DB and TS media scanners match; DB and TS completeness match (both locales and one removed); real bundle JSON parses with zero hidden blocks and zero warnings |
| DB (pgTAP) | 88 | Unchanged from the approved Step 2 |

Not tested here: the full network path through PostgREST/supabase-js. The fake client covers the request side and the round-trip covers the data side; CI's database job exercises a real Supabase stack.

## 5. Decisions for review

1. **`clinical_case` blocks only embed a versioned case**, by `case_id`. I dropped the "or inline stages" option from the original plan, because inline stages would bypass case versioning and claims.
2. **Cases have no media in Sprint 1.** The DB media scanner covers topic blocks only. Adding case images later needs a migration to extend the scanner and lock rules.
3. **Shape is checked in the app layer, not the DB.** The DB checks presence; content schemas are enforced by `saveBlock` and the bundle parser. A staff user writing raw JSON through the API could store an invalid block; it would be hidden at render and flagged in staff preview. DB-side JSON-schema validation is possible later.
4. **Error reasons are derived from message text.** This is guarded by the scan test, so it is safe today. A sturdier option is a stable reason code in each `raise` (e.g. via `HINT`). That would be a migration edit, which is still allowed before the first deployment. Recommended, but not done without approval.
5. **DB types come from my introspection script** because Docker isn't available here. On the first local Supabase run, regenerate with `pnpm db:types` (the official generator). That also fills `Relationships`, which enables typed joins.
