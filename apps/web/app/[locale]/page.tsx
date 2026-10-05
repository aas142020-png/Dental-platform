import { redirect } from "@/i18n/navigation";

export default async function LocaleIndex({ params }: { params: Promise<{ locale: "ar" | "en" }> }) {
  const { locale } = await params;
  redirect({ href: "/home", locale });
}
