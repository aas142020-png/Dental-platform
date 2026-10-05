import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf } from "@dental/i18n";
import { color } from "@dental/design-tokens";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: "app" });
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: color.light.surface,
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={directionOf(locale)}>
      <body className="min-h-dvh bg-surface text-text antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
