import { BookOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { sectionMetadata } from "@/lib/page-meta";

export const generateMetadata = sectionMetadata("learn");

export default async function Page({ params }: { params: Promise<{ locale: "ar" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("learn.title")} />
      <EmptyState icon={BookOpen} title={t("learn.emptyTitle")} body={t("learn.emptyBody")} />
    </>
  );
}
