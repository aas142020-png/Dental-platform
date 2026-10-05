import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Section = "home" | "learn" | "practice" | "clinical" | "profile";

/** Localized <title> for a section page. */
export const sectionMetadata = (section: Section) =>
  async ({ params }: { params: Promise<{ locale: "ar" | "en" }> }): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: section });
    return { title: t("title") };
  };
