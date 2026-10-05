"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

/** Same page in the other language. next-intl's middleware stores the choice in the NEXT_LOCALE cookie. */
export function LocaleSwitch() {
  const t = useTranslations("shell");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <Link
      href={pathname}
      locale={other}
      aria-label={t("switchLanguageLabel")}
      data-locale-switch={other}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Languages aria-hidden className="size-4" />
      <span lang={other}>{t("switchLanguage")}</span>
    </Link>
  );
}
