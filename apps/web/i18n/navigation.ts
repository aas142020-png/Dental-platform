import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link, redirect, usePathname (pathname without the locale prefix), useRouter. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
