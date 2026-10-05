import { getTranslations } from "next-intl/server";
import { NavLinks } from "./nav-links";
import { TopBar } from "./top-bar";

/**
 * Responsive shell. Layout changes per breakpoint rather than stretching:
 *   < 768px      bottom tab bar (safe-area aware)
 *   768–1279px   icon rail on the start edge
 *   >= 1280px    labelled sidebar on the start edge
 * "Start" is right in Arabic and left in English: only logical CSS properties are used.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
      >
        {t("shell.skipToContent")}
      </a>

      <nav aria-label={t("nav.label")} data-shell="side"
           className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col gap-6 border-e border-border bg-surface px-4 py-5 desktop:flex">
        <p className="px-3 text-lg font-semibold">{t("app.name")}</p>
        <NavLinks variant="side" />
      </nav>

      <nav aria-label={t("nav.label")} data-shell="rail"
           className="fixed inset-y-0 start-0 z-30 hidden w-20 flex-col items-center border-e border-border bg-surface pt-4 tablet:flex desktop:hidden">
        <NavLinks variant="rail" />
      </nav>

      <div className="tablet:ps-20 desktop:ps-64">
        <TopBar />
        <main id="content" tabIndex={-1}
              className="mx-auto w-full max-w-5xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 focus:outline-none tablet:px-8 tablet:pb-10">
          {children}
        </main>
      </div>

      <nav aria-label={t("nav.label")} data-shell="bottom"
           className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface tablet:hidden"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <NavLinks variant="bottom" />
      </nav>
    </>
  );
}
