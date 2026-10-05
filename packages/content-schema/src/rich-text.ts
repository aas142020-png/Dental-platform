import { z } from "zod";
import { LocalId } from "./primitives";

/**
 * Restricted rich text: a JSON tree, not HTML or markdown.
 * Safe to render on web and native, no parsing, no injection surface.
 *
 *   RichText   = (Paragraph | List)[]
 *   Paragraph  = { type: "paragraph", children: Inline[] }
 *   List       = { type: "list", ordered, items: Inline[][] }
 *   Inline     = { type: "text", text, marks? } | { type: "claim", anchor }
 *
 * A claim node marks where a clinical statement is evidenced. Its `anchor`
 * must match a block_claims.anchor of the same block. A claim linked with an
 * empty anchor applies to the block as a whole and needs no marker.
 */
export const Mark = z.enum(["bold", "italic"]);

export const TextNode = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(Mark).max(2).optional(),
});

export const ClaimNode = z.strictObject({
  type: z.literal("claim"),
  anchor: LocalId,
});

export const InlineWithClaims = z.array(z.discriminatedUnion("type", [TextNode, ClaimNode])).min(1);
export const InlinePlain = z.array(TextNode).min(1);

const paragraph = <T extends z.ZodType>(inline: T) =>
  z.strictObject({ type: z.literal("paragraph"), children: inline });
const list = <T extends z.ZodType>(inline: T) =>
  z.strictObject({ type: z.literal("list"), ordered: z.boolean(), items: z.array(inline).min(1).max(30) });

/** Rich text that may carry claim markers (topic blocks). */
export const RichText = z
  .array(z.discriminatedUnion("type", [paragraph(InlineWithClaims), list(InlineWithClaims)]))
  .min(1)
  .max(50);

/** Rich text without claim markers (case stages: claims attach to the case version). */
export const RichTextPlain = z
  .array(z.discriminatedUnion("type", [paragraph(InlinePlain), list(InlinePlain)]))
  .min(1)
  .max(50);

export type TextNode = z.infer<typeof TextNode>;
export type ClaimNode = z.infer<typeof ClaimNode>;
export type Inline = TextNode | ClaimNode;
export type RichText = z.infer<typeof RichText>;
export type RichTextPlain = z.infer<typeof RichTextPlain>;

/** Collect every claim anchor used anywhere in a value (walks any JSON). */
export function collectClaimAnchors(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectClaimAnchors(v, out);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.type === "claim" && typeof o.anchor === "string") out.push(o.anchor);
    else for (const v of Object.values(o)) collectClaimAnchors(v, out);
  }
  return out;
}

/** Plain text of a rich-text value (search indexing, previews, alt fallbacks). */
export function toPlainText(value: RichText | RichTextPlain | Inline[]): string {
  const inline = (nodes: readonly { type: string; text?: string }[]) =>
    nodes.map((n) => (n.type === "text" ? n.text : "")).join("");
  return (value as unknown[])
    .map((node) => {
      const n = node as { type: string; children?: Inline[]; items?: Inline[][]; text?: string };
      if (n.type === "paragraph") return inline(n.children ?? []);
      if (n.type === "list") return (n.items ?? []).map(inline).join("\n");
      return n.type === "text" ? (n.text ?? "") : "";
    })
    .join("\n");
}
