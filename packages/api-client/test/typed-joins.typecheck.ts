/**
 * Compile-time proof that the official generated types (with Relationships) support typed joins.
 * Never executed; `pnpm typecheck` fails if any of these stop compiling.
 */
import type { DentalClient } from "../src";

export async function typedJoinProbe(c: DentalClient) {
  // Version -> topic -> specialty, disambiguated by FK name (topics has two FKs to topic_versions).
  const { data: v } = await c
    .from("topic_versions")
    .select("id, version_no, topic:topics!topic_versions_topic_id_fkey(slug, specialty:specialties(slug))")
    .eq("status", "published")
    .single();
  if (v) {
    const version: number = v.version_no;
    const topicSlug: string = v.topic.slug;
    const specialtySlug: string = v.topic.specialty.slug;
    void [version, topicSlug, specialtySlug];
  }

  // One-to-many: claim -> its source links -> source title.
  const { data: claims } = await c
    .from("claims")
    .select("id, claim_sources(locator, supporting_passage, source:sources(title, status))");
  for (const cl of claims ?? []) {
    for (const link of cl.claim_sources) {
      const title: string = link.source.title;
      const status: "active" | "under_review" | "superseded" | "retracted" = link.source.status;
      void [title, status];
    }
  }

  // Question identity -> its versions (typed enum status).
  const { data: q } = await c.from("questions").select("id, question_versions!question_versions_question_id_fkey(version_no, status)").single();
  if (q) {
    const statuses: string[] = q.question_versions.map((x) => x.status);
    void statuses;
  }

  // Unknown columns are rejected at the type level.
  const { data: bad } = await c.from("topics").select("not_a_column").single();
  // @ts-expect-error not_a_column does not exist on topics
  const nope: string = bad!.not_a_column;
  void nope;
}
