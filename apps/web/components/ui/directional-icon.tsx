import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icons that express reading direction (back, next, chevrons, progress arrows) are drawn for LTR
 * and mirrored in RTL. Non-directional icons (tooth, search, book) must NOT use this wrapper,
 * and anatomical illustrations are never mirrored.
 */
export function DirectionalIcon({ icon: Icon, className, ...props }: { icon: LucideIcon } & LucideProps) {
  return <Icon aria-hidden data-directional="" className={cn("rtl:-scale-x-100", className)} {...props} />;
}
