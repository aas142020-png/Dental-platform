import {
  CURRENT_SCHEMA_VERSION, parseBlock, parseCase, parseQuestion,
  type BlockType, type CaseContent, type QuestionContent,
} from "@dental/content-schema";
import type { ContentStatus, Json, VersionEntityType } from "@dental/db-types";
import type { DentalClient } from "./client";
import { ApiError, unwrap, unwrapMaybe } from "./errors";
import { parseTopicBundle, type TopicBundle } from "./bundle";

/* All functions here are for staff. RLS and the workflow function enforce roles server-side;
   the client never decides permissions. */

export async function listAdminTopics(c: DentalClient) {
  return unwrap(await c.from("v_admin_topics").select("*").order("specialty_slug").order("sort_order"));
}

/** Any version (draft included) for staff preview, parsed with issues kept. */
export async function getVersionBundle(c: DentalClient, versionId: string): Promise<TopicBundle | null> {
  const raw = unwrapMaybe(await c.rpc("get_version_bundle", { p_version_id: versionId }));
  return raw == null ? null : parseTopicBundle(raw);
}

/* ---------- Draft-on-edit ---------- */

export async function createTopicDraft(c: DentalClient, topicId: string, changeNote?: string) {
  return unwrap(await c.rpc("create_topic_draft", { p_topic_id: topicId, p_change_note: changeNote }));
}
export async function createQuestionDraft(c: DentalClient, questionId: string, changeNote?: string) {
  return unwrap(await c.rpc("create_question_draft", { p_question_id: questionId, p_change_note: changeNote }));
}
export async function createCaseDraft(c: DentalClient, caseId: string, changeNote?: string) {
  return unwrap(await c.rpc("create_case_draft", { p_case_id: caseId, p_change_note: changeNote }));
}

/* ---------- Workflow ---------- */

/** The only way to change editorial status. Errors carry kind + reason (see errors.ts). */
export async function transition(
  c: DentalClient, entityType: VersionEntityType, versionId: string, to: ContentStatus, note?: string,
): Promise<ContentStatus> {
  return unwrap(await c.rpc("transition_content", {
    p_entity_type: entityType, p_entity_id: versionId, p_to: to, p_note: note,
  }));
}

export async function listWorkflowEvents(c: DentalClient, entityType: VersionEntityType, versionId: string) {
  return unwrap(await c.from("workflow_events").select("*")
    .eq("entity_type", entityType).eq("entity_id", versionId).order("created_at", { ascending: false }));
}

/* ---------- Blocks (draft versions only; the DB rejects writes to non-draft versions) ---------- */

export interface BlockInput {
  id?: string;           // omit to insert
  type: BlockType;
  position: number;
  content: unknown;
  schemaVersion?: number; // defaults to the current version for the type
}

const invalid = (message: string, issues: import("@dental/content-schema").Issue[]) =>
  new ApiError({ kind: "content_invalid", message, issues });

/**
 * Validate, then insert or update a block. Content with errors is never sent.
 * Claim checks are not run here (claim links are separate rows); validateVersion() covers them.
 */
export async function saveBlock(c: DentalClient, versionId: string, input: BlockInput) {
  const schema_version = input.schemaVersion ?? CURRENT_SCHEMA_VERSION[input.type];
  const r = parseBlock({ id: input.id ?? "new", position: input.position, type: input.type, schema_version, content: input.content });
  if (!r.ok) throw invalid(`${input.type} block content is invalid`, r.issues);

  // Store the parsed content so schema defaults are persisted explicitly.
  const row = { topic_version_id: versionId, position: input.position, type: input.type,
    schema_version, content: r.value.content as unknown as Json };
  return input.id
    ? unwrap(await c.from("topic_blocks").update(row).eq("id", input.id).select("*").single())
    : unwrap(await c.from("topic_blocks").insert(row).select("*").single());
}

export async function deleteBlock(c: DentalClient, blockId: string) {
  unwrapMaybe(await c.from("topic_blocks").delete().eq("id", blockId));
}

/** Set block order. Must list every block of the version exactly once. */
export async function reorderBlocks(c: DentalClient, versionId: string, blockIds: string[]) {
  unwrapMaybe(await c.rpc("reorder_blocks", { p_version_id: versionId, p_block_ids: blockIds }));
}

export async function updateTopicVersionMeta(
  c: DentalClient, versionId: string,
  patch: { title?: Record<string, string>; subtitle?: Record<string, string>; est_minutes?: number | null; change_note?: string | null },
) {
  return unwrap(await c.from("topic_versions").update(patch).eq("id", versionId).select("*").single());
}

/* ---------- Question / case versions ---------- */

export async function saveQuestionVersion(c: DentalClient, versionId: string, content: unknown) {
  const r = parseQuestion(content);
  if (!r.ok) throw invalid("question content is invalid", r.issues);
  const q: QuestionContent = r.value;
  return unwrap(await c.from("question_versions").update({
    kind: q.kind, stem: q.stem, options: q.options as unknown as Json,
    explanation: q.explanation, difficulty: q.difficulty,
  }).eq("id", versionId).select("*").single());
}

export async function saveCaseVersion(c: DentalClient, versionId: string, title: Record<string, string>, content: unknown) {
  const r = parseCase(content);
  if (!r.ok) throw invalid("case content is invalid", r.issues);
  const cc: CaseContent = r.value;
  return unwrap(await c.from("case_versions").update({ title, content: cc as unknown as Json })
    .eq("id", versionId).select("*").single());
}

/* ---------- Embed traceability ---------- */

export interface EmbedConsumer { topicId: string; topicSlug: string; topicVersionId: string; topicVersionNo: number; blockId: string }

/**
 * Which published topics currently display a given question/case VERSION.
 * Derived from existing data, nothing stored:
 *   a version is displayed only if it is its identity's published_version_id;
 *   it is then displayed by every published topic version whose blocks embed that identity id.
 * Historical answers ("what did topic X show on date D") come from workflow_events timestamps.
 */
export async function getVersionConsumers(
  c: DentalClient, kind: "question" | "case", versionId: string,
): Promise<{ identityId: string; isLive: boolean; consumers: EmbedConsumer[] }> {
  let identityId: string;
  let liveVersionId: string | null;
  if (kind === "question") {
    identityId = unwrap(await c.from("question_versions").select("question_id").eq("id", versionId).single()).question_id;
    liveVersionId = unwrap(await c.from("questions").select("published_version_id").eq("id", identityId).single()).published_version_id;
  } else {
    identityId = unwrap(await c.from("case_versions").select("case_id").eq("id", versionId).single()).case_id;
    liveVersionId = unwrap(await c.from("cases").select("published_version_id").eq("id", identityId).single()).published_version_id;
  }
  if (liveVersionId !== versionId) return { identityId, isLive: false, consumers: [] };

  return { identityId, isLive: true, consumers: await getIdentityConsumers(c, kind, identityId) };
}

/** Published topic versions that embed a question/case identity (whatever version is live). */
export async function getIdentityConsumers(c: DentalClient, kind: "question" | "case", identityId: string): Promise<EmbedConsumer[]> {
  const blocks = unwrap(await c.from("topic_blocks").select("id, topic_version_id")
    .eq("type", kind === "question" ? "quiz" : "clinical_case")
    .contains("content", kind === "question"
      ? { shared: { question_ids: [identityId] } }
      : { shared: { case_id: identityId } }));
  if (blocks.length === 0) return [];

  const versions = unwrap(await c.from("topic_versions").select("id, topic_id, version_no")
    .in("id", [...new Set(blocks.map((b) => b.topic_version_id))]).eq("status", "published"));
  if (versions.length === 0) return [];

  const topics = unwrap(await c.from("topics").select("id, slug").in("id", versions.map((v) => v.topic_id)));
  const slug = new Map(topics.map((t) => [t.id, t.slug]));
  const byVersion = new Map(versions.map((v) => [v.id, v]));

  return blocks.flatMap((b) => {
    const v = byVersion.get(b.topic_version_id);
    return v ? [{ topicId: v.topic_id, topicSlug: slug.get(v.topic_id) ?? "", topicVersionId: v.id, topicVersionNo: v.version_no, blockId: b.id }] : [];
  });
}
