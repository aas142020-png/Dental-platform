/**
 * Integration: the TypeScript layer and the database agree.
 * Runs when DATABASE_URL points at a migrated database (local Supabase or the harness);
 * skipped otherwise. Everything happens in one transaction that is rolled back.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres pnpm --filter @dental/api-client test
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EXAMPLE_IDS, collectAssetIds, exampleCase, exampleQuestion, examples, validateVersion,
} from "@dental/content-schema";
import { mediaFor, parseTopicBundle, toApiError } from "../src";

const url = process.env.DATABASE_URL;
const STAFF = "00000000-0000-4000-8000-0000000000e1";
const blocks = Object.values(examples);

describe.skipIf(!url)("database round-trip", () => {
  const db = new pg.Client({ connectionString: url });
  let versionId = "";
  let qvId = "";
  let cvId = "";
  const one = async <T = any>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] as T;

  beforeAll(async () => {
    await db.connect();
    await db.query("begin");
    // A staff session so the bundle includes in-progress embeds (staff preview path).
    await db.query("insert into auth.users (id, email) values ($1, 'rt@test.local')", [STAFF]);
    await db.query("insert into public.staff_roles (user_id, role) values ($1, 'editor')", [STAFF]);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [STAFF]);

    const spec = await one("insert into public.specialties (slug, name, is_active) values ('rt-spec', '{\"en\":\"RT\"}', true) returning id");
    const topic = await one("insert into public.topics (specialty_id, slug, access_level) values ($1, 'rt-topic', 'public') returning id", [spec.id]);
    versionId = (await one(
      "insert into public.topic_versions (topic_id, version_no, title) values ($1, 1, $2) returning id",
      [topic.id, { ar: "عنوان", en: "Title" }])).id;

    for (const id of [EXAMPLE_IDS.claimA, EXAMPLE_IDS.claimB]) {
      await db.query("insert into public.claims (id, statement) values ($1, '{\"en\":\"placeholder\"}')", [id]);
    }
    for (const [id, kind] of [[EXAMPLE_IDS.imageAsset, "image"], [EXAMPLE_IDS.animationAsset, "lottie"],
                              [EXAMPLE_IDS.posterAsset, "image"], [EXAMPLE_IDS.diagramAsset, "svg"]] as const) {
      await db.query("insert into public.media_assets (id, storage_path, kind, alt) values ($1, $2, $3, $4)",
        [id, `rt/${id}`, kind, { ar: "وصف", en: "alt" }]);
    }
    for (const b of blocks) {
      await db.query(
        "insert into public.topic_blocks (id, topic_version_id, position, type, schema_version, content) values ($1, $2, $3, $4, $5, $6)",
        [b.id, versionId, b.position, b.type, b.schema_version, b.content]);
      for (const c of b.claims ?? []) {
        await db.query("insert into public.block_claims (block_id, claim_id, anchor) values ($1, $2, $3)", [b.id, c.claim_id, c.anchor]);
      }
    }

    await db.query("insert into public.questions (id, access_level) values ($1, 'public')", [EXAMPLE_IDS.question]);
    qvId = (await one(
      `insert into public.question_versions (question_id, version_no, kind, stem, options, explanation, difficulty)
       values ($1, 1, $2, $3, $4, $5, $6) returning id`,
      [EXAMPLE_IDS.question, exampleQuestion.kind, exampleQuestion.stem, JSON.stringify(exampleQuestion.options),
       exampleQuestion.explanation, exampleQuestion.difficulty])).id;

    await db.query("insert into public.cases (id, specialty_id, slug, access_level) values ($1, $2, 'rt-case', 'public')", [EXAMPLE_IDS.case, spec.id]);
    cvId = (await one("insert into public.case_versions (case_id, version_no, title, content) values ($1, 1, $2, $3) returning id",
      [EXAMPLE_IDS.case, { ar: "حالة", en: "Case" }, exampleCase])).id;
  });

  afterAll(async () => {
    await db.query("rollback");
    await db.end();
  });

  it("the database accepts every example block", async () => {
    expect((await one("select count(*)::int n from public.topic_blocks where topic_version_id = $1", [versionId])).n).toBe(11);
  });

  it("DB media scanner and collectAssetIds find the same assets", async () => {
    const rows = (await db.query("select private.version_asset_ids($1)::text id", [versionId])).rows.map((r) => r.id).sort();
    const ts = new Set<string>();
    for (const b of blocks) collectAssetIds(b.content, ts);
    expect(rows).toEqual([...ts].sort());
    expect(rows).toHaveLength(4);
  });

  it("DB locale completeness and validateVersion agree (both locales)", async () => {
    const db_ = (await one("select private.complete_locales('topic_version', $1)::text[] l", [versionId])).l;
    expect(db_).toEqual(["ar", "en"]);
    expect(validateVersion({ title: { ar: "عنوان", en: "Title" }, blocks }).completeLocales).toEqual(db_);
  });

  it("DB locale completeness and validateVersion agree (one locale removed)", async () => {
    await db.query("savepoint s");
    await db.query("update public.topic_blocks set content = content - 'en' where id = $1", [examples.quiz.id]);
    const db_ = (await one("select private.complete_locales('topic_version', $1)::text[] l", [versionId])).l;
    const ts = structuredClone(blocks); delete (ts.find((b) => b.id === examples.quiz.id)!.content as any).en;
    expect(db_).toEqual(["ar"]);
    expect(validateVersion({ title: { ar: "عنوان", en: "Title" }, blocks: ts }).completeLocales).toEqual(db_);
    await db.query("rollback to savepoint s");
  });

  it("example question and case are complete in both locales in the DB", async () => {
    expect((await one("select private.complete_locales('question_version', $1)::text[] l", [qvId])).l).toEqual(["ar", "en"]);
    expect((await one("select private.complete_locales('case_version', $1)::text[] l", [cvId])).l).toEqual(["ar", "en"]);
  });

  it("the real bundle JSON parses cleanly: all blocks, embeds and media", async () => {
    const raw = (await one("select private.build_version_bundle($1) b", [versionId])).b;
    const bundle = parseTopicBundle(raw);
    expect(bundle.hidden).toEqual([]);
    expect(bundle.warnings).toEqual([]);
    expect(bundle.blocks).toHaveLength(11);
    expect(bundle.questions[EXAMPLE_IDS.question]?.versionId).toBe(qvId);
    expect(bundle.cases[EXAMPLE_IDS.case]?.versionId).toBe(cvId);
    expect(Object.keys(bundle.media)).toHaveLength(4);
    const anim = bundle.blocks.find((b) => b.type === "animation");
    expect(anim?.type === "animation" && mediaFor(bundle, anim.content.shared.poster)?.path).toBe(`rt/${EXAMPLE_IDS.posterAsset}`);
    expect(Object.keys(bundle.claims).sort()).toEqual([EXAMPLE_IDS.claimA, EXAMPLE_IDS.claimB].sort());
  });

  it("real database errors map to stable reasons through the driver's hint field", async () => {
    const fail = async (sql: string, params: unknown[] = []) => {
      await db.query("savepoint e");
      try { await db.query(sql, params); return null; }
      catch (err) { return toApiError(err); }
      finally { await db.query("rollback to savepoint e"); }
    };
    // Staff session (editor only): draft -> published is not an allowed transition.
    const notAllowed = await fail("select public.transition_content('topic_version', $1, 'published')", [versionId]);
    expect([notAllowed?.kind, notAllowed?.reason]).toEqual(["workflow_rule", "transition_not_allowed"]);
    // Editor lacks the source_verifier role.
    const role = await fail("select public.transition_content('topic_version', $1, 'source_verified')", [versionId]);
    expect([role?.kind, role?.reason]).toEqual(["forbidden", "role_required"]);
    // Second in-progress question version.
    const dup = await fail("select public.create_question_draft($1)", [EXAMPLE_IDS.question]);
    expect(dup?.reason).toBe("version_in_progress");
    // No session at all.
    await db.query("savepoint s2");
    await db.query("select set_config('request.jwt.claim.sub', '', true)");
    const signIn = await fail("select public.transition_content('topic_version', $1, 'source_verified')", [versionId]);
    await db.query("rollback to savepoint s2");
    expect([signIn?.kind, signIn?.reason]).toEqual(["unauthenticated", "sign_in_required"]);
  });
});
