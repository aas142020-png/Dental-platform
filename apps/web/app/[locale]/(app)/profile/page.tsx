import {getTranslations,setRequestLocale} from "next-intl/server";
import {PageHeader} from "@/components/ui/page-header";
import {sectionMetadata} from "@/lib/page-meta";
import {getAuthState} from "@/lib/auth";
import {Link} from "@/i18n/navigation";
import {SignOutButton} from "@/components/auth/sign-out-button";
export const generateMetadata=sectionMetadata("profile");
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{locale:"ar"|"en"}>}){const {locale}=await params;setRequestLocale(locale);const t=await getTranslations();const {user,profile}=await getAuthState();return <><PageHeader title={t("profile.title")}/><div className="mx-auto max-w-lg rounded-xl border border-border p-5">{!user?<div className="flex flex-col gap-3"><p>{t("profile.guestBody")}</p><Link href="/sign-in" className="rounded-md bg-accent px-4 py-3 text-center text-accent-contrast">{t("auth.sign-inAction")}</Link><Link href="/sign-up" className="rounded-md border border-border px-4 py-3 text-center">{t("auth.sign-upAction")}</Link></div>:<div className="flex flex-col gap-3"><p>{user.email}</p>{!profile?.onboarded_at&&<Link href="/onboarding" className="rounded-md bg-accent px-4 py-3 text-center text-accent-contrast">{t("profile.finishOnboarding")}</Link>}<SignOutButton locale={locale}/></div>}</div></>}
