/**
 * Mirror of the database scanner `private.version_asset_ids()`:
 *   jsonb_path_query(content, 'lax $.**.asset_id')  + uuid format filter
 * Collects the value of every key named `asset_id`, at any depth, that looks like a uuid.
 * Kept in lockstep with the DB by test (test/media-scanner.test.ts + fixtures from Postgres).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function collectAssetIds(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectAssetIds(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "asset_id" && typeof v === "string" && UUID.test(v)) out.add(v.toLowerCase());
      collectAssetIds(v, out);
    }
  }
  return out;
}
