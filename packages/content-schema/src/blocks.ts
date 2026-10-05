import { z } from "zod";
import { Id, LocalId, MediaRef, NonEmpty } from "./primitives";
import { InlineWithClaims, RichText } from "./rich-text";

/**
 * Block content envelope (matches topic_blocks.content):
 *   { "ar"?: <locale payload>, "en"?: <locale payload>, "shared": <language-neutral payload> }
 *
 * - A locale key may be absent in drafts; publish readiness is decided by editorial policy.
 * - `shared` holds ids, layout, and media refs. Media refs live ONLY in `shared` and only as { asset_id }.
 * - Objects are strict: unknown keys are errors, so typos never pass silently.
 */
const envelope = <L extends z.ZodType, S extends z.ZodType>(locale: L, shared: S) =>
  z.strictObject({ ar: locale.optional(), en: locale.optional(), shared });

const Empty = z.strictObject({});
const OptionalHeading = z.strictObject({ heading: NonEmpty.optional() });

// 1. summary — key points at the top of a topic
export const SummaryV1 = envelope(
  z.strictObject({ heading: NonEmpty.optional(), points: z.array(InlineWithClaims).min(1).max(10) }),
  Empty,
);

// 2. text — main explanatory section
export const TextV1 = envelope(
  z.strictObject({ heading: NonEmpty.optional(), body: RichText }),
  Empty,
);

// 3. illustration — static image or SVG
export const IllustrationV1 = envelope(
  z.strictObject({ caption: InlineWithClaims.optional() }),
  z.strictObject({
    image: MediaRef,
    aspect: z.enum(["auto", "1:1", "4:3", "3:4", "16:9"]).default("auto"),
    zoomable: z.boolean().default(true),
  }),
);

// 4. animation — Lottie or video. Sprint 1 renders the poster only (authoring out of scope).
export const AnimationV1 = envelope(
  z.strictObject({
    caption: InlineWithClaims.optional(),
    step_labels: z.array(NonEmpty).max(20).default([]),
  }),
  z.strictObject({
    media: MediaRef,
    poster: MediaRef.optional(),
    loop: z.boolean().default(false),
  }),
);

// 5. interactive_diagram — labelled hotspots on an image. Sprint 1 renders the poster only.
export const Hotspot = z.strictObject({
  id: LocalId,
  x: z.number().min(0).max(1), // fraction of image width, from the image's own left edge (never mirrored)
  y: z.number().min(0).max(1),
});
export const InteractiveDiagramV1 = envelope(
  z.strictObject({
    caption: InlineWithClaims.optional(),
    hotspots: z.array(z.strictObject({ id: LocalId, label: NonEmpty, description: RichText.optional() })).min(1).max(30),
  }),
  z.strictObject({
    image: MediaRef,
    poster: MediaRef.optional(),
    hotspots: z.array(Hotspot).min(1).max(30),
  }),
);

// 6. comparison — side-by-side table
export const ComparisonV1 = envelope(
  z.strictObject({
    title: NonEmpty.optional(),
    columns: z.array(NonEmpty).min(2).max(6),
    rows: z.array(z.strictObject({ label: NonEmpty, cells: z.array(InlineWithClaims) })).min(1).max(30),
  }),
  Empty,
);

// 7. clinical_pearl — short practical tip
export const ClinicalPearlV1 = envelope(
  z.strictObject({ title: NonEmpty.optional(), body: RichText }),
  Empty,
);

// 8. warning — safety point or common error
export const WarningV1 = envelope(
  z.strictObject({ title: NonEmpty, body: RichText }),
  z.strictObject({ severity: z.enum(["caution", "danger"]) }),
);

// 9. clinical_case — embeds a versioned teaching case by stable identity id
export const ClinicalCaseV1 = envelope(OptionalHeading, z.strictObject({ case_id: Id }));

// 10. quiz — embeds versioned questions by stable identity id
export const QuizV1 = envelope(
  OptionalHeading,
  z.strictObject({ question_ids: z.array(Id).min(1).max(10) }),
);

// 11. source_list — sources behind the topic's claims (auto) or a chosen subset (manual)
export const SourceListV1 = envelope(
  OptionalHeading,
  z.discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("auto") }),
    z.strictObject({ mode: z.literal("manual"), source_ids: z.array(Id).min(1).max(50) }),
  ]),
);

/** Mirrors the `block_type` enum. Order = editor palette order. */
export const BLOCK_TYPES = [
  "summary", "text", "illustration", "animation", "interactive_diagram", "comparison",
  "clinical_pearl", "warning", "clinical_case", "quiz", "source_list",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Registry: type -> schema_version -> schema.
 * Adding a version: add the schema here, keep old versions so stored content still parses.
 */
export const blockRegistry = {
  summary: { 1: SummaryV1 },
  text: { 1: TextV1 },
  illustration: { 1: IllustrationV1 },
  animation: { 1: AnimationV1 },
  interactive_diagram: { 1: InteractiveDiagramV1 },
  comparison: { 1: ComparisonV1 },
  clinical_pearl: { 1: ClinicalPearlV1 },
  warning: { 1: WarningV1 },
  clinical_case: { 1: ClinicalCaseV1 },
  quiz: { 1: QuizV1 },
  source_list: { 1: SourceListV1 },
} as const satisfies Record<BlockType, Record<number, z.ZodType>>;

export const CURRENT_SCHEMA_VERSION: Record<BlockType, number> = Object.fromEntries(
  BLOCK_TYPES.map((t) => [t, Math.max(...Object.keys(blockRegistry[t]).map(Number))]),
) as Record<BlockType, number>;

/** Block types whose content is clinical by nature; the CMS warns when they carry no claims. */
export const CLINICAL_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  "summary", "text", "comparison", "clinical_pearl", "warning",
]);

/** Block types with no learner-facing text of their own (locale payload may be {}). */
export const STRUCTURAL_BLOCK_TYPES: ReadonlySet<BlockType> = new Set(["clinical_case", "quiz", "source_list"]);

export type BlockContentMap = { [K in BlockType]: z.output<(typeof blockRegistry)[K][1]> };
export type BlockContent<K extends BlockType = BlockType> = BlockContentMap[K];

/** A parsed block, discriminated by type. */
export type Block = {
  [K in BlockType]: {
    id: string;
    position: number;
    type: K;
    schema_version: number;
    content: BlockContentMap[K];
    claims: { claim_id: string; anchor: string }[];
  };
}[BlockType];
