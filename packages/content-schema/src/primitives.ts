import { z } from "zod";

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Any 8-4-4-4-12 hex id. (z.uuid() would reject non-v4 ids used in seeds/tests.) */
export const Id = z.guid();

/** Plain, non-empty single-line-ish string. */
export const NonEmpty = z.string().trim().min(1);

/** {"ar": "...", "en": "..."} — every key optional; completeness is checked separately. */
export const LocalizedString = z.strictObject({ ar: NonEmpty.optional(), en: NonEmpty.optional() });
export type LocalizedString = z.infer<typeof LocalizedString>;

/**
 * Canonical media reference. The database media scanner (`lax $.**.asset_id`)
 * finds every object key named exactly `asset_id`, at any depth.
 * Every reference to a media asset MUST use this shape; never `poster_id`, `image_id`, etc.
 */
export const MediaRef = z.strictObject({ asset_id: Id });
export type MediaRef = z.infer<typeof MediaRef>;

/** Stable id for an item inside a block (hotspot, option, stage). */
export const LocalId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/, "lowercase id, max 32 chars");
