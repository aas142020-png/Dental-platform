import { House } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { sectionMetadata } from "@/lib/page-meta";

export const generateMetadata = sectionMetadata("home");

export default async function Page({ params }: { params: Promise<{ locale: "ar" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("home.title")} />
      <EmptyState icon={House} title={t("home.emptyTitle")} body={t("home.emptyBody")} />
    </>
  );
}
