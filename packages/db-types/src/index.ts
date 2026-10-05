export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes } from "./database";
export { Constants } from "./database";
import type { Database } from "./database";

/** Row type of a view (the official generator folds views into Tables<>; this keeps a views-only alias). */
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];

/** Mirrors the `locale_code` enum. */
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Mirrors the `content_status` enum, in workflow order. */
export const CONTENT_STATUSES = [
  "draft", "source_verified", "clinical_review", "visual_review", "approved", "published", "archived",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Mirrors the `access_level` enum. */
export const ACCESS_LEVELS = ["public", "authenticated", "premium"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** Mirrors the `staff_role` enum. */
export const STAFF_ROLES = ["editor", "source_verifier", "clinical_reviewer", "visual_reviewer", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Versioned entity types accepted by transition_content(). */
export const VERSION_ENTITY_TYPES = ["topic_version", "question_version", "case_version"] as const;
export type VersionEntityType = (typeof VERSION_ENTITY_TYPES)[number];
