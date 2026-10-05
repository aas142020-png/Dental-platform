import { BookOpen, House, ListChecks, Stethoscope, UserRound, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "learn" | "practice" | "clinical" | "profile";

/** Single source for the five areas. All three nav presentations render from this list. */
export const NAV_ITEMS: readonly { key: NavKey; href: `/${NavKey}`; icon: LucideIcon }[] = [
  { key: "home", href: "/home", icon: House },
  { key: "learn", href: "/learn", icon: BookOpen },
  { key: "practice", href: "/practice", icon: ListChecks },
  { key: "clinical", href: "/clinical", icon: Stethoscope },
  { key: "profile", href: "/profile", icon: UserRound },
];

/** Active when on the item's page or anywhere below it (e.g. /learn/endodontics). */
export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export const activeNavKey = (pathname: string): NavKey | undefined =>
  NAV_ITEMS.find((i) => isActive(pathname, i.href))?.key;

/**
 * Parent of a nested page, for the back button: "/learn/endodontics/pulp-anatomy" -> "/learn/endodontics".
 * Top-level areas ("/learn") have no back button. Paths are locale-free (next-intl usePathname).
 */
export const parentPath = (pathname: string): string | null => {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : null;
};
