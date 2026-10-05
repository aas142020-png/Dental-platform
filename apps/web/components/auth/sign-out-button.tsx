"use client";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
export function SignOutButton({locale}:{locale:"ar"|"en"}){const t=useTranslations("auth");return <button className="min-h-11 rounded-md border border-border px-4" onClick={async()=>{await createClient().auth.signOut();location.assign(`/${locale}/home`)}}>{t("signOut")}</button>}
