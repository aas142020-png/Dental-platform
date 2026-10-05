import {safeAuthNext} from "@/lib/auth-redirect";
import {getTranslations,setRequestLocale} from "next-intl/server";
import {AuthForm} from "@/components/auth/auth-form";
export default async function Page({params,searchParams}:{params:Promise<{locale:"ar"|"en"}>;searchParams:Promise<{next?:string}>}){const {locale}=await params;setRequestLocale(locale);const t=await getTranslations("auth");const q=await searchParams;const next=safeAuthNext(q.next,locale);return <section className="px-4 py-10"><h1 className="mb-6 text-center text-2xl font-semibold">{t("signInTitle")}</h1><AuthForm mode="sign-in" locale={locale} next={next}/></section>}

