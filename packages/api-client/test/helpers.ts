import { examples, exampleCase, exampleQuestion, EXAMPLE_IDS } from "@dental/content-schema";
import type { DentalClient } from "../src";

/** A bundle shaped exactly like private.build_version_bundle() output, built from the examples. */
export function exampleBundleJson(): any {
  const blocks = Object.values(examples).map((b) => ({ ...b, claims: b.claims ?? [] }));
  const media = (id: string, kind = "image") => ({
    bucket: "content-media", path: `x/${id}.png`, kind, mime_type: "image/png", width: 800, height: 600,
    alt: { ar: "وصف", en: "Alt text" }, caption: {}, credit: null,
  });
  return structuredClone({
    topic: { id: "t1", slug: "demo", access_level: "public" },
    version: { id: "v1", version_no: 1, status: "published", title: { ar: "عنوان", en: "Title" }, subtitle: {}, est_minutes: 5, published_at: "2026-10-05T00:00:00Z" },
    available_locales: ["ar", "en"],
    can_read: true,
    blocks,
    claims: {
      [EXAMPLE_IDS.claimA]: { statement: { en: "Claim A" }, links: [{ source_id: EXAMPLE_IDS.source, locator: "p. 1", passage: "exact", support: "direct", verified_at: "2026-10-01T00:00:00Z" }] },
      [EXAMPLE_IDS.claimB]: { statement: { en: "Claim B" }, links: [] },
    },
    sources: { [EXAMPLE_IDS.source]: { title: "Placeholder", organization: null, authors: null, url: null, doi: null, publication_date: null, version_label: null, evidence_type: "textbook", status: "active", last_reviewed_at: null } },
    questions: { [EXAMPLE_IDS.question]: { version_id: "qv2", version_no: 2, status: "published", available_locales: ["ar", "en"], ...exampleQuestion } },
    cases: { [EXAMPLE_IDS.case]: { version_id: "cv1", version_no: 1, status: "published", available_locales: ["ar", "en"], title: { ar: "حالة", en: "Case" }, content: exampleCase } },
    media: {
      [EXAMPLE_IDS.imageAsset]: media(EXAMPLE_IDS.imageAsset),
      [EXAMPLE_IDS.animationAsset]: media(EXAMPLE_IDS.animationAsset, "lottie"),
      [EXAMPLE_IDS.posterAsset]: media(EXAMPLE_IDS.posterAsset),
      [EXAMPLE_IDS.diagramAsset]: media(EXAMPLE_IDS.diagramAsset, "svg"),
    },
  });
}

/**
 * Minimal stand-in for supabase-js: records every builder call and resolves with a
 * canned response per table / rpc. Enough to test argument shaping and error handling.
 */
export function fakeClient(responses: Record<string, unknown | ((calls: [string, unknown[]][]) => unknown)>, userId: string | null = "u1") {
  const log: { target: string; calls: [string, unknown[]][] }[] = [];
  const resolve = (key: string, calls: [string, unknown[]][]) => {
    const r = responses[key];
    return Promise.resolve(typeof r === "function" ? (r as Function)(calls) : r ?? { data: null, error: null });
  };
  const builder = (target: string) => {
    const entry = { target, calls: [] as [string, unknown[]][] };
    log.push(entry);
    const proxy: any = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return (ok: any, fail: any) => resolve(target, entry.calls).then(ok, fail);
        return (...args: unknown[]) => { entry.calls.push([prop, args]); return proxy; };
      },
    });
    return proxy;
  };
  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => { log.push({ target: `rpc:${fn}`, calls: [["rpc", [args]]] }); return resolve(`rpc:${fn}`, [["rpc", [args]]]); },
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
  };
  return { client: client as unknown as DentalClient, log };
}
