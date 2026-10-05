import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden className="size-8 text-text-muted" strokeWidth={1.5} />
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="max-w-prose text-text-muted">{body}</p>
    </section>
  );
}
