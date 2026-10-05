"use client";
import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";
export function AuthForm({ mode, locale, next = `/${locale}/home` }: { mode: Mode; locale: "ar"|"en"; next?: string }) {
  const t = useTranslations("auth"); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget); const email=String(form.get("email")||""); const password=String(form.get("password")||"");
    const supabase=createClient();
    let error: {message:string}|null=null;
    if(mode==="sign-up") ({error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${location.origin}/auth/callback?locale=${locale}&next=${encodeURIComponent(`/${locale}/onboarding`)}`,data:{preferred_locale:locale}}}));
    if(mode==="sign-in") ({error}=await supabase.auth.signInWithPassword({email,password}));
    if(mode==="forgot") ({error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/auth/callback?locale=${locale}&next=${encodeURIComponent(`/${locale}/reset-password`)}`}));
    if(mode==="reset") ({error}=await supabase.auth.updateUser({password}));
    setBusy(false);
    if(error) return setMessage(error.message);
    if(mode==="sign-in") {
      const {data:{user}}=await supabase.auth.getUser();
      const {data:profile}=await supabase.from("profiles").select("onboarded_at").eq("id",user!.id).maybeSingle();
      location.assign(profile?.onboarded_at?next:`/${locale}/onboarding`);
    }
    else if(mode==="reset") location.assign(`/${locale}/home`);
    else setMessage(t(mode==="forgot"?"resetSent":"checkEmail"));
  }
  async function magic() {
    const form=document.querySelector<HTMLFormElement>("[data-auth-form]"); const email=String(new FormData(form!).get("email")||"");
    setBusy(true); const {error}=await createClient().auth.signInWithOtp({email,options:{emailRedirectTo:`${location.origin}/auth/callback?locale=${locale}&next=${encodeURIComponent(next)}`,shouldCreateUser:false}}); setBusy(false);
    setMessage(error?.message ?? t("checkEmail"));
  }
  return <form data-auth-form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-border p-5">
    {mode!=="reset" && <label className="flex flex-col gap-2 text-sm">{t("email")}<input name="email" type="email" required autoComplete="email" className="min-h-11 rounded-md border border-border bg-surface px-3" /></label>}
    {mode!=="forgot" && <label className="flex flex-col gap-2 text-sm">{t(mode==="reset"?"newPassword":"password")}<input name="password" type="password" required minLength={8} autoComplete={mode==="sign-in"?"current-password":"new-password"} className="min-h-11 rounded-md border border-border bg-surface px-3" /></label>}
    <button disabled={busy} className="min-h-11 rounded-md bg-accent px-4 text-accent-contrast disabled:opacity-50">{t(`${mode}Action`)}</button>
    {mode==="sign-in" && <button type="button" disabled={busy} onClick={magic} className="min-h-11 rounded-md border border-border px-4">{t("magicLink")}</button>}
    {mode==="sign-in" && <Link href="/forgot-password" className="min-h-11 text-center">{t("forgotTitle")}</Link>}
    {mode==="sign-in" && <Link href="/sign-up" className="min-h-11 text-center">{t("signUpTitle")}</Link>}
    {(mode==="sign-up"||mode==="forgot") && <Link href="/sign-in" className="min-h-11 text-center">{t("signInTitle")}</Link>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
