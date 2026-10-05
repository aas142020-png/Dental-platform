import type { DentalClient } from "./client";
import { unwrap, unwrapMaybe } from "./errors";
import { parseTopicBundle, type TopicBundle } from "./bundle";

/** Active specialties (staff also see inactive ones). */
export async function listSpecialties(c: DentalClient) {
  return unwrap(await c.from("v_specialties").select("*").order("sort_order"));
}

/** Published topics of a specialty. `can_read` false = show locked state. */
export async function listTopics(c: DentalClient, specialtySlug: string) {
  return unwrap(await c.from("v_topic_catalog").select("*").eq("specialty_slug", specialtySlug).order("sort_order"));
}

/** Full published topic in one request. null = not listed for this caller. */
export async function getTopic(c: DentalClient, specialtySlug: string, topicSlug: string): Promise<TopicBundle | null> {
  const raw = unwrapMaybe(await c.rpc("get_topic_bundle", { p_specialty_slug: specialtySlug, p_topic_slug: topicSlug }));
  return raw == null ? null : parseTopicBundle(raw);
}

/** A source the caller is allowed to see (RLS: cited by readable content, or staff). */
export async function getSource(c: DentalClient, sourceId: string) {
  return unwrapMaybe(await c.from("sources").select("*").eq("id", sourceId).maybeSingle());
}
