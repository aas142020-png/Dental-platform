"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-config";

type Variant = "bottom" | "rail" | "side";

const item: Record<Variant, string> = {
  bottom: "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs",
  rail: "flex w-16 flex-col items-center gap-1 rounded-md py-2.5 text-[0.6875rem] leading-tight",
  side: "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
};

/** The five nav areas in one of three presentations. Exactly one is visible at any width. */
export function NavLinks({ variant }: { variant: Variant }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className={cn(variant === "bottom" ? "flex" : "flex flex-col gap-1", variant === "rail" && "items-center")}>
      {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={key} className={cn(variant === "bottom" && "flex flex-1")}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              data-nav={key}
              className={cn(
                item[variant],
                "text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active && "font-medium text-accent",
                active && variant !== "bottom" && "bg-surface-muted",
              )}
            >
              <Icon aria-hidden className={variant === "side" ? "size-5" : "size-6"} strokeWidth={active ? 2.25 : 1.75} />
              <span className="max-w-full truncate whitespace-nowrap" data-nav-label="">{t(key)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
