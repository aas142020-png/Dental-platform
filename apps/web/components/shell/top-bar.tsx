"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { DirectionalIcon } from "@/components/ui/directional-icon";
import { activeNavKey, parentPath } from "./nav-config";
import { LocaleSwitch } from "./locale-switch";

export function TopBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const key = activeNavKey(pathname);
  const parent = parentPath(pathname);
  return (
    <header
      className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 tablet:px-8">
        {parent && (
          <Link
            href={parent}
            data-back=""
            aria-label={t("shell.back")}
            className="-ms-2 inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <DirectionalIcon icon={ChevronLeft} className="size-5" />
          </Link>
        )}
        {/* Top-level areas already show their name as the page heading; repeat it here only on sub-pages. */}
        <p className="min-w-0 flex-1 truncate text-base font-semibold" aria-hidden data-topbar-title="">
          {parent && key ? t(`nav.${key}`) : ""}
        </p>
        <LocaleSwitch />
      </div>
    </header>
  );
}
