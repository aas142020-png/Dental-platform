import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "./supabase/server";

export type Locale = "ar" | "en";
export async function getAuthState() {
  // Opt out before the SDK can catch Next.js's static-rendering bailout.
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, staffRoles: [] as string[] };
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id,role,study_year,specialty_interest,preferred_locale,onboarded_at").eq("id", user.id).maybeSingle(),
    supabase.from("staff_roles").select("role").eq("user_id", user.id),
  ]);
  return { user, profile, staffRoles: (roles ?? []).map((r) => r.role) };
}
export async function requireUser(locale: Locale) {
  const state = await getAuthState();
  if (!state.user) redirect(`/${locale}/sign-in?next=/${locale}/onboarding`);
  return state;
}
