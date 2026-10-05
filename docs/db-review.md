# Database review guide (Steps 1–2)

Read the migrations in order; each file is one concern.

| File | Contents |
| --- | --- |
| 0001 enums | All enums; `private` schema (not exposed by the API); `updated_at` trigger |
| 0002 identity | `profiles` (auto-created on sign-up), `staff_roles` (many roles per user), `editorial_policy` |
| 0003 media | `media_assets` with bilingual alt/caption and its own review status |
| 0004 content | `specialties`, `topics` (with `access_level`), `topic_versions`, `topic_version_locales`, `topic_blocks` |
| 0005 evidence | `sources`, `claims`, `claim_sources` (exact passage + locator + verification), `block_claims` |
| 0006 practice | `questions` + `question_versions`, `cases` + `case_versions` (identity vs content), per-version claim links and locales, `case_topics` |
| 0007 user data | `user_interests`, `user_progress`, `saved_items` |
| 0008 workflow | Transition rules, audit log, guards, immutability, readiness checks, embed guards, generic `transition_content()` for topic/question/case versions |
| 0009 access + RLS | `listed` vs `readable` helpers, access levels, RLS on all 27 tables |
| 0010 views | `v_specialties`, `v_topic_catalog`, `v_admin_topics`, `v_source_impact` (detail), `v_flagged_sources` (per-source summary) |
| 0011 RPCs | `get_topic_bundle`, `get_version_bundle`, `create_topic_draft`, `create_question_draft`, `create_case_draft`, `reorder_blocks`, `upsert_progress` |
| 0012 storage | Private `content-media` bucket; read only for approved media or staff |

## Editorial policy (configuration, not code)

| Key | Alpha value | Effect |
| --- | --- | --- |
| `required_publish_locales` | `["ar","en"]` | Locales that must be complete to publish. Each complete locale goes live and is recorded per locale, so AR or EN can later be withheld independently. |
| `four_eyes_review` | `false` | When true, the author of a version cannot perform any review step on it. |
| `require_claims_for_source_verification` | `true` | Content with zero linked claims cannot reach Source Verified. |
| `require_alt_text` | `true` | Images/SVGs need alt text in each required locale before Approved. |

## Transitions (`workflow_transitions` table)

| From → To | Role | Checks |
| --- | --- | --- |
| draft → source_verified | source_verifier | ≥1 block; ≥1 claim (policy); every claim has a verified link to an `active` source |
| source_verified → clinical_review | editor | — |
| clinical_review → visual_review | clinical_reviewer | four-eyes if enabled |
| visual_review → approved | visual_reviewer | referenced media exist, approved, alt text per policy |
| approved → published | admin | required locales complete; topic: media ready and every embedded question/case has a live version; previous live version archived |
| published → archived | admin | note required; parent unpublished; refused for a question/case embedded in a live topic |
| draft → archived | admin | note required (abandon a draft) |
| any review state → draft | any staff | note required |

Alpha: one account holds all five roles via five `staff_roles` rows. Splitting roles later is a data change, not a code change.

## Access model

- **Listed** (titles in catalog): published and specialty active. Applies to everyone, including anon.
- **Readable** (blocks, claims, passages): listed + `access_level` allows: `public` = anyone, `authenticated` = signed in, `premium` = `private.has_premium_access()`, which returns false in Sprint 1. Staff read everything.
- Learners see only verified source links of readable claims.

## Versioning (topics, questions, cases)

All three follow one model. The identity row (`topics`, `questions`, `cases`) holds the stable id, relationships, `access_level` and `published_version_id`. Version rows hold content, status, claim links, locales, author and publication time.

- Editing live content: `create_*_draft()` copies the live version (content + claim links) into a new draft. Only one version in progress per item.
- The live version stays live until the replacement is published; publishing archives it in the same transaction.
- No transition leaves `archived`.
- Topic blocks embed questions/cases by **identity id** (`shared.question_ids[]`, `shared.case_id`). Bundles resolve each to its live version, so drafts never leak and embeds never break during editing.
- A question/case embedded in a live topic cannot be unpublished; it can only be superseded.
- A topic cannot be published while it embeds an item with no live version.
- Consequence to be aware of: publishing a new question version updates what every live topic embedding it shows, without a new topic version. This matches "live until replaced"; the question's own review covers the change.

## Source impact review

`v_source_impact` has one row per non-active source → verified link → claim → published content version, with `remaining_active_direct_support` and `severity`. `v_flagged_sources` summarises per source. Nothing is unpublished automatically. Staff only.

| Severity | Rule |
| --- | --- |
| critical | Source retracted, the link was direct support, and no verified direct link from an active source remains |
| high | No active direct support remains, but not the critical case (superseded or under-review source; or a retracted partial link) |
| low | At least one verified direct link from an active source still backs the claim |

Content that uses the claim only in drafts is not listed.

## Accepted for Sprint 1

Claims without their own status; configurable locales and four-eyes; public/authenticated/premium; listed vs readable; human-only transitions; no automatic unpublishing; both locales in bundles; client-visible quiz answers (non-graded); private media bucket. Block schemas (Step 3) must keep the `asset_id` key for every media reference.

## Tests (88, all passing)

`01_access_rls` (13): seed shape, anon/learner isolation, no self-granted roles, no audit-log writes.
`02_workflow` (38): status guard, evidence gates, role gates, locks, full Draft→Published path, audit log, visibility by access level, topic draft-on-edit, four-eyes, independent locale publishing, service role cannot publish.
`03_question_case_versioning` (24): live version unaffected by drafts, immutability, draft copies claims, one in progress, unpublish blocked while embedded, supersede on publish, audit trail, no reopening archived versions, topic blocked on unpublished embed, staff preview of drafts.
`04_source_impact` (13): sole direct retracted → critical; alternative active direct → low; superseded sole → high; multi-content impact; draft-only use excluded; summary ordering; no auto-unpublish; learners can't see the queue.
