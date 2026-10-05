import { ListChecks } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { sectionMetadata } from "@/lib/page-meta";

export const generateMetadata = sectionMetadata("practice");

export default async function Page({ params }: { params: Promise<{ locale: "ar" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("practice.title")} />
      <EmptyState icon={ListChecks} title={t("common.comingSoon")} body={t("common.comingSoonBody")} />
    </>
  );
}
