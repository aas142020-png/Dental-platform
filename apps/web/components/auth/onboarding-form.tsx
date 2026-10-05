"use client";
import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@dental/db-types";

type Profile={role:Enums<"user_role">|null;study_year:number|null;specialty_interest:string|null;preferred_locale:"ar"|"en"};
export function OnboardingForm({locale,profile}:{locale:"ar"|"en";profile:Profile}) {
 const t=useTranslations("onboarding"); const [role,setRole]=useState(profile.role??""); const [message,setMessage]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault(); const f=new FormData(e.currentTarget); const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
  const study=role==="student"?Number(f.get("study_year")):null;
  if(!["student","intern","general_dentist","specialist"].includes(role))return;
  const preferredLocale=f.get("preferred_locale")==="en"?"en":"ar";
  const {error}=await supabase.from("profiles").update({role:role as Enums<"user_role">,study_year:study,specialty_interest:String(f.get("specialty_interest")||"").trim()||null,preferred_locale:preferredLocale,onboarded_at:new Date().toISOString()}).eq("id",user.id).select("id").single();
  if(error)return setMessage(error.message); document.cookie=`NEXT_LOCALE=${String(f.get("preferred_locale"))}; Path=/; Max-Age=31536000; SameSite=Lax`; location.assign(`/${String(f.get("preferred_locale"))}/home`);
 }
 return <form onSubmit={submit} className="mx-auto flex w-full max-w-lg flex-col gap-5 rounded-xl border border-border p-5">
  <label className="flex flex-col gap-2">{t("role")}<select name="role" required value={role} onChange={e=>setRole(e.target.value)} className="min-h-11 rounded-md border border-border bg-surface px-3"><option value="">{t("choose")}</option>{(["student","intern","general_dentist","specialist"] as const).map(x=><option key={x} value={x}>{t(`roles.${x}`)}</option>)}</select></label>
  {role==="student"&&<label className="flex flex-col gap-2">{t("studyYear")}<select name="study_year" required defaultValue={profile.study_year??""} className="min-h-11 rounded-md border border-border bg-surface px-3"><option value="">{t("choose")}</option>{[1,2,3,4,5,6].map(y=><option key={y} value={y}>{y}</option>)}</select></label>}
  <label className="flex flex-col gap-2">{t("interests")}<input name="specialty_interest" defaultValue={profile.specialty_interest??""} maxLength={200} className="min-h-11 rounded-md border border-border bg-surface px-3" /></label>
  <label className="flex flex-col gap-2">{t("language")}<select name="preferred_locale" defaultValue={profile.preferred_locale??locale} className="min-h-11 rounded-md border border-border bg-surface px-3"><option value="ar">العربية</option><option value="en">English</option></select></label>
  <button className="min-h-11 rounded-md bg-accent px-4 text-accent-contrast">{t("complete")}</button>{message&&<p role="alert">{message}</p>}
 </form>
}

