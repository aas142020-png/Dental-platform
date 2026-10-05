import { z } from "zod";
import {
  LOCALES, parseBlock, parseCase, parseQuestion,
  type Block, type CaseContent, type Issue, type Locale, type MediaRef, type QuestionContent,
} from "@dental/content-schema";
import type { AccessLevel, ContentStatus } from "@dental/db-types";
import { ApiError } from "./errors";

/**
 * Envelope of get_topic_bundle / get_version_bundle.
 * Envelope objects are NOT strict (the server may add fields without breaking older clients);
 * block/question/case content IS strict, via @dental/content-schema.
 */
const Loc = z.record(z.string(), z.string());
const Status = z.enum(["draft", "source_verified", "clinical_review", "visual_review", "approved", "published", "archived"]);
const LocaleList = z.array(z.enum(LOCALES));

const Envelope = z.object({
  topic: z.object({ id: z.string(), slug: z.string(), access_level: z.enum(["public", "authenticated", "premium"]) }),
  version: z.object({
    id: z.string(), version_no: z.number(), status: Status,
    title: Loc, subtitle: Loc, est_minutes: z.number().nullable(), published_at: z.string().nullable(),
  }),
  available_locales: LocaleList,
  can_read: z.boolean(),
  blocks: z.array(z.object({
    id: z.string(), position: z.number(), type: z.string(), schema_version: z.number(),
    content: z.unknown(), claims: z.array(z.object({ claim_id: z.string(), anchor: z.string() })),
  })),
  claims: z.record(z.string(), z.object({
    statement: Loc,
    links: z.array(z.object({
      source_id: z.string(), locator: z.string(), passage: z.string(),
      support: z.enum(["direct", "partial", "contextual"]), verified_at: z.string().nullable(),
    })),
  })),
  sources: z.record(z.string(), z.object({
    title: z.string(), organization: z.string().nullable(), authors: z.string().nullable(),
    url: z.string().nullable(), doi: z.string().nullable(), publication_date: z.string().nullable(),
    version_label: z.string().nullable(), evidence_type: z.string(),
    status: z.enum(["active", "under_review", "superseded", "retracted"]), last_reviewed_at: z.string().nullable(),
  })),
  questions: z.record(z.string(), z.object({
    version_id: z.string(), version_no: z.number(), status: Status, available_locales: LocaleList,
    kind: z.unknown(), stem: z.unknown(), options: z.unknown(), explanation: z.unknown(), difficulty: z.unknown(),
  })),
  cases: z.record(z.string(), z.object({
    version_id: z.string(), version_no: z.number(), status: Status, available_locales: LocaleList,
    title: Loc, content: z.unknown(),
  })),
  media: z.record(z.string(), z.object({
    bucket: z.string(), path: z.string(), kind: z.enum(["image", "svg", "video", "lottie", "model3d"]),
    mime_type: z.string().nullable(), width: z.number().nullable(), height: z.number().nullable(),
    alt: Loc, caption: Loc, credit: z.string().nullable(),
  })),
});
type Envelope = z.infer<typeof Envelope>;

export interface ResolvedQuestion {
  identityId: string; versionId: string; versionNo: number; status: ContentStatus;
  availableLocales: Locale[]; content: QuestionContent;
}
export interface ResolvedCase {
  identityId: string; versionId: string; versionNo: number; status: ContentStatus;
  availableLocales: Locale[]; title: Record<string, string>; content: CaseContent;
}
export interface HiddenItem { kind: "block" | "question" | "case"; id: string; type?: string; issues: Issue[] }

export interface TopicBundle {
  topic: { id: string; slug: string; accessLevel: AccessLevel };
  version: Envelope["version"];
  availableLocales: Locale[];
  /** false = listed but locked (e.g. sign-in or premium required); blocks are empty. */
  canRead: boolean;
  /** Valid blocks in position order. */
  blocks: Block[];
  /** Blocks and embeds that failed validation: never rendered to learners; shown to staff. */
  hidden: HiddenItem[];
  /** Warnings on rendered blocks/embeds (staff preview). */
  warnings: { id: string; issues: Issue[] }[];
  claims: Envelope["claims"];
  sources: Envelope["sources"];
  /** Keyed by stable question identity id (what quiz blocks embed). */
  questions: Record<string, ResolvedQuestion>;
  /** Keyed by stable case identity id (what clinical_case blocks embed). */
  cases: Record<string, ResolvedCase>;
  media: Envelope["media"];
}

export function parseTopicBundle(raw: unknown): TopicBundle {
  const env = Envelope.safeParse(raw);
  if (!env.success) {
    throw new ApiError({ kind: "content_invalid", message: "topic bundle has an unexpected shape",
      issues: env.error.issues.map((i) => ({ code: "invalid_shape", severity: "error",
        path: i.path as (string | number)[], message: i.message })) });
  }
  const b = env.data;
  const hidden: HiddenItem[] = [];
  const warnings: TopicBundle["warnings"] = [];

  const blocks: Block[] = [];
  for (const raw of [...b.blocks].sort((x, y) => x.position - y.position)) {
    const r = parseBlock(raw);
    if (r.ok) {
      blocks.push(r.value);
      if (r.issues.length) warnings.push({ id: raw.id, issues: r.issues });
    } else {
      hidden.push({ kind: "block", id: raw.id, type: raw.type, issues: r.issues });
    }
  }

  const questions: Record<string, ResolvedQuestion> = {};
  for (const [id, q] of Object.entries(b.questions)) {
    const r = parseQuestion({ kind: q.kind, stem: q.stem, options: q.options, explanation: q.explanation, difficulty: q.difficulty });
    if (r.ok) {
      questions[id] = { identityId: id, versionId: q.version_id, versionNo: q.version_no, status: q.status,
        availableLocales: q.available_locales, content: r.value };
      if (r.issues.length) warnings.push({ id, issues: r.issues });
    } else hidden.push({ kind: "question", id, issues: r.issues });
  }

  const cases: Record<string, ResolvedCase> = {};
  for (const [id, c] of Object.entries(b.cases)) {
    const r = parseCase(c.content);
    if (r.ok) {
      cases[id] = { identityId: id, versionId: c.version_id, versionNo: c.version_no, status: c.status,
        availableLocales: c.available_locales, title: c.title, content: r.value };
      if (r.issues.length) warnings.push({ id, issues: r.issues });
    } else hidden.push({ kind: "case", id, issues: r.issues });
  }

  return {
    topic: { id: b.topic.id, slug: b.topic.slug, accessLevel: b.topic.access_level },
    version: b.version,
    availableLocales: b.available_locales,
    canRead: b.can_read,
    blocks, hidden, warnings,
    claims: b.claims, sources: b.sources, questions, cases, media: b.media,
  };
}

/** Resolve a { asset_id } reference against the bundle's media map. */
export const mediaFor = (bundle: Pick<TopicBundle, "media">, ref: MediaRef | undefined) =>
  ref ? bundle.media[ref.asset_id.toLowerCase()] : undefined;
