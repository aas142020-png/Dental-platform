/**
 * The client's error mapping against REAL PostgREST error bodies from the live project
 * (fixtures/postgrest-live-*.json). Closes the Step 3 gap: wire format -> ApiError.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toApiError, parseTopicBundle } from "../src";

const fx = JSON.parse(readFileSync(join(__dirname, "fixtures/postgrest-live-2026-10-05.json"), "utf8"));
const res = (probe: string) => fx.responses.find((r: { probe: string }) => r.probe === probe);

describe("live PostgREST responses", () => {
  it.each([
    ["auth_transition_not_found", "not_found", "not_found"],
    ["auth_transition_bad_entity", "invalid_input", "invalid_entity_type"],
    ["auth_progress_unavailable", "forbidden", "topic_unavailable"],
    ["auth_version_bundle_staff_only", "forbidden", "role_required"],
    ["auth_create_draft_editor_only", "forbidden", "role_required"],
    ["auth_self_grant_admin_rls", "forbidden", undefined],
    ["anon_transition_denied", "forbidden", undefined],
    ["anon_private_not_exposed", "invalid_input", undefined],
  ])("%s -> %s / %s", (probe, kind, reason) => {
    const e = toApiError(res(probe).body);
    expect(e.kind).toBe(kind);
    expect(e.reason).toBe(reason);
  });

  it("every live hint is a reason the client recognises", () => {
    for (const r of fx.responses) {
      const hint = r.body?.hint;
      if (hint) expect(toApiError(r.body).reason, r.probe).toBeDefined();
    }
  });

  it("an unlisted topic returns null over the wire (getTopic returns null, not an error)", () => {
    expect(res("anon_topic_bundle").body).toBeNull();
  });

  it("private schema is not reachable through the API", () => {
    expect(res("anon_private_not_exposed").status).toBe(404);
  });

  it("parser is not involved for null bundles", () => {
    expect(() => parseTopicBundle(res("anon_topic_bundle").body)).toThrow(); // null is not a bundle; catalog.getTopic short-circuits before parsing
  });
});

describe("live PostgREST responses after the hardening migration", () => {
  const fx2 = JSON.parse(readFileSync(join(__dirname, "fixtures/postgrest-live-2026-10-05-hardening.json"), "utf8"));
  const r2 = (probe: string) => fx2.responses.find((r: { probe: string }) => r.probe === probe);

  it("not-found is HTTP 404 with PT404 and the unchanged stable reason", () => {
    const r = r2("auth_transition_not_found");
    expect(r.status).toBe(404);
    expect(r.body.code).toBe("PT404");
    const e = toApiError(r.body);
    expect([e.kind, e.reason]).toEqual(["not_found", "not_found"]);
  });

  it("seeded drafts stay invisible to learners and anon", () => {
    for (const p of ["anon_specialties", "anon_topics_hidden", "auth_drafts_hidden"]) expect(r2(p).body).toEqual([]);
    for (const p of ["anon_seeded_topic_bundle", "auth_seeded_topic_bundle"]) expect(r2(p).body).toBeNull();
  });

  it("a non-staff user cannot move a real seeded draft", () => {
    const e = toApiError(r2("auth_transition_real_draft_role").body);
    expect([e.kind, e.reason]).toEqual(["forbidden", "role_required"]);
  });
});
