import ar from "../messages/ar.json";
import en from "../messages/en.json";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const directionOf = (locale: Locale): "rtl" | "ltr" => (locale === "ar" ? "rtl" : "ltr");

export const messages = { ar, en } as const;

/**
 * Western digits (0–9) in both locales, by product decision.
 * `ar-u-nu-latn` keeps Arabic formatting rules but Latin digits.
 */
export const intlLocale = (locale: Locale): string => (locale === "ar" ? "ar-u-nu-latn" : "en");

export const formatNumber = (locale: Locale, value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(intlLocale(locale), options).format(value);

export const formatDate = (locale: Locale, value: Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intlLocale(locale), { calendar: "gregory", ...options }).format(value);
