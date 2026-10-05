import {redirect} from "next/navigation";
import {getTranslations,setRequestLocale} from "next-intl/server";
import {OnboardingForm} from "@/components/auth/onboarding-form";
import {requireUser} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{locale:"ar"|"en"}>}){const {locale}=await params;setRequestLocale(locale);const {profile}=await requireUser(locale);if(profile?.onboarded_at)redirect(`/${locale}/profile`);const t=await getTranslations("onboarding");return <section className="px-4 py-10"><h1 className="mb-2 text-center text-2xl font-semibold">{t("title")}</h1><p className="mb-6 text-center text-sm text-text-muted">{t("body")}</p><OnboardingForm locale={locale} profile={{role:profile?.role??null,study_year:profile?.study_year??null,specialty_interest:profile?.specialty_interest??null,preferred_locale:(profile?.preferred_locale??locale) as "ar"|"en"}}/></section>}
