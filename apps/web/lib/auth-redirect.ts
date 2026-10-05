export function safeAuthNext(value: string | null | undefined, locale: "ar" | "en") {
  const fallback = `/${locale}/home`;
  if (!value || !value.startsWith(`/${locale}/`) || /[\\\r\n]/.test(value)) return fallback;
  const parsed = new URL(value, "https://local.invalid");
  return parsed.origin === "https://local.invalid" && parsed.pathname.startsWith(`/${locale}/`)
    ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
}
