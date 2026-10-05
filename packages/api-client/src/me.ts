import { z } from "zod";
import type { DentalClient } from "./client";
import { ApiError, unwrap, unwrapMaybe } from "./errors";

async function requireUserId(c: DentalClient): Promise<string> {
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) throw new ApiError({ kind: "unauthenticated", message: "sign in required", reason: "sign_in_required" });
  return data.user.id;
}

export async function getMyProfile(c: DentalClient) {
  const uid = await requireUserId(c);
  return unwrap(await c.from("profiles").select("*").eq("id", uid).single());
}

/** Onboarding answers. Validated before any write. */
export const ProfileInput = z.strictObject({
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["student", "intern", "general_dentist", "specialist", "other"]).optional(),
  study_level: z.enum(["preclinical", "clinical_year", "intern", "postgrad", "practitioner"]).optional(),
  preferred_locale: z.enum(["ar", "en"]).optional(),
  institution: z.string().trim().max(160).nullable().optional(),
});
export type ProfileInput = z.infer<typeof ProfileInput>;

export async function updateMyProfile(c: DentalClient, input: ProfileInput, opts: { completeOnboarding?: boolean } = {}) {
  const parsed = ProfileInput.safeParse(input);
  if (!parsed.success) {
    throw new ApiError({ kind: "invalid_input", message: "invalid profile input",
      issues: parsed.error.issues.map((i) => ({ code: "invalid_shape", severity: "error", path: i.path as (string | number)[], message: i.message })) });
  }
  const uid = await requireUserId(c);
  const patch = { ...parsed.data, ...(opts.completeOnboarding ? { onboarded_at: new Date().toISOString() } : {}) };
  return unwrap(await c.from("profiles").update(patch).eq("id", uid).select("*").single());
}

/** Replace the user's specialty interests with exactly this set. */
export async function setMyInterests(c: DentalClient, specialtyIds: string[]) {
  const uid = await requireUserId(c);
  const ids = [...new Set(specialtyIds)];
  const del = c.from("user_interests").delete().eq("user_id", uid);
  unwrapMaybe(await (ids.length ? del.not("specialty_id", "in", `(${ids.join(",")})`) : del));
  if (ids.length) {
    unwrapMaybe(await c.from("user_interests").upsert(ids.map((specialty_id) => ({ user_id: uid, specialty_id })),
      { onConflict: "user_id,specialty_id", ignoreDuplicates: true }));
  }
}

export async function getMyStaffRoles(c: DentalClient) {
  const uid = await requireUserId(c);
  return unwrap(await c.from("staff_roles").select("role").eq("user_id", uid)).map((r) => r.role);
}

export async function listMyProgress(c: DentalClient) {
  return unwrap(await c.from("user_progress").select("*").order("updated_at", { ascending: false }));
}

/** Percent only moves forward and completion is sticky (enforced server-side). */
export async function recordProgress(c: DentalClient, input: { topicId: string; percent: number; lastBlockId?: string; completed?: boolean }) {
  return unwrap(await c.rpc("upsert_progress", {
    p_topic_id: input.topicId,
    p_percent: Math.round(Math.min(100, Math.max(0, input.percent))),
    p_last_block_id: input.lastBlockId,
    p_completed: input.completed ?? false,
  }));
}

export type SavedItemType = "topic" | "block" | "question" | "case" | "source";

export async function listSaved(c: DentalClient) {
  return unwrap(await c.from("saved_items").select("*").order("created_at", { ascending: false }));
}
export async function saveItem(c: DentalClient, itemType: SavedItemType, itemId: string, note?: string) {
  const uid = await requireUserId(c);
  return unwrap(await c.from("saved_items").upsert({ user_id: uid, item_type: itemType, item_id: itemId, note: note ?? null }).select("*").single());
}
export async function unsaveItem(c: DentalClient, itemType: SavedItemType, itemId: string) {
  const uid = await requireUserId(c);
  unwrapMaybe(await c.from("saved_items").delete().match({ user_id: uid, item_type: itemType, item_id: itemId }));
}
