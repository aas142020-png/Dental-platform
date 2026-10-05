import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "@dental/i18n";

/**
 * Every user route is locale-prefixed: /ar/..., /en/...
 * Locale on first visit: URL, then NEXT_LOCALE cookie, then Accept-Language, then Arabic.
 * (Profile preferred_locale joins this order in Step 5, when accounts exist.)
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
