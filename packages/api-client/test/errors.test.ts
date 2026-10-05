import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError, REASON_KIND, WORKFLOW_REASONS, reasonFromHint, toApiError } from "../src";

const MIGRATIONS = join(__dirname, "../../../supabase/migrations");
const sqlFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))
  .map((f) => ({ f, sql: readFileSync(join(MIGRATIONS, f), "utf8") }));

/** Each `raise exception ...;` statement, found with a quote-aware scan (messages may contain ';'). */
function raiseStatements(): { file: string; stmt: string }[] {
  const out: { file: string; stmt: string }[] = [];
  for (const { f, sql } of sqlFiles) {
    for (const m of sql.matchAll(/raise exception/g)) {
      let i = m.index!, q = false, depth = 0;
      for (; i < sql.length; i++) {
        const c = sql[i];
        if (q) { if (c === "'" && sql[i + 1] === "'") { i++; continue; } if (c === "'") q = false; }
        else if (c === "'") q = true;
        else if (c === "(") depth++;
        else if (c === ")") depth--;
        else if (c === ";" && depth === 0) break;
      }
      out.push({ file: f, stmt: sql.slice(m.index!, i) });
    }
  }
  return out;
}

describe("database reason contract", () => {
  const raises = raiseStatements();
  const hinted = raises.map((r) => ({ ...r, reason: /hint\s*=\s*'reason:([a-z_]+)'/.exec(r.stmt)?.[1] }));

  it("finds the raises", () => expect(raises.length).toBeGreaterThanOrEqual(46));

  it.each(hinted.map((h) => [h.file, h.stmt.replace(/\s+/g, " ").slice(0, 90), h.reason] as const))(
    "%s: %s → %s",
    (_f, _s, reason) => {
      expect(reason, "every raise must carry hint = 'reason:<code>'").toBeDefined();
      expect(WORKFLOW_REASONS).toContain(reason);
    },
  );

  it("every client reason is raised somewhere (no dead codes)", () => {
    const used = new Set(hinted.map((h) => h.reason));
    expect(WORKFLOW_REASONS.filter((r) => !used.has(r))).toEqual([]);
  });

  it("the contract comment in migration 0008 lists exactly the client reasons", () => {
    const sql = sqlFiles.find((x) => x.f.includes("_workflow"))!.sql;
    const block = sql.slice(sql.indexOf("-- Codes:"), sql.indexOf("-- The list is mirrored"));
    const listed = block.replace(/--|Codes:/g, "").split(/[\s,.]+/).filter(Boolean).sort();
    expect(listed).toEqual([...WORKFLOW_REASONS].sort());
  });

  it("every reason maps to an error kind", () => {
    for (const r of WORKFLOW_REASONS) expect(REASON_KIND[r]).toBeDefined();
  });
});

describe("reasonFromHint", () => {
  it.each([
    ["reason:claims_unverified", "claims_unverified"],
    ["  reason:locked  ", "locked"],
    ["reason:something_new", undefined], // unknown code from a newer server: no reason, fall back to SQLSTATE
    ["Perhaps you meant to reference the column", undefined], // ordinary Postgres hints
    ["", undefined],
    [null, undefined],
  ])("%j → %s", (hint, reason) => expect(reasonFromHint(hint)).toBe(reason));
});

describe("toApiError", () => {
  const cases: [object, string, string | undefined][] = [
    [{ code: "P0001", message: "2 of 3 claims lack a verified link", hint: "reason:claims_unverified" }, "workflow_rule", "claims_unverified"],
    [{ code: "P0001", message: "required locales incomplete: {en}", hint: "reason:locales_incomplete" }, "workflow_rule", "locales_incomplete"],
    [{ code: "P0001", message: "embedded in 2 published topic version(s)", hint: "reason:embedded_live" }, "workflow_rule", "embedded_live"],
    [{ code: "P0001", message: "this topic already has a version in progress", hint: "reason:version_in_progress" }, "workflow_rule", "version_in_progress"],
    [{ code: "42501", message: "four-eyes policy", hint: "reason:four_eyes" }, "forbidden", "four_eyes"],
    [{ code: "42501", message: "role admin required", hint: "reason:role_required" }, "forbidden", "role_required"],
    [{ code: "42501", message: "blocks of a non-draft version are locked", hint: "reason:locked" }, "workflow_rule", "locked"],
    [{ code: "42501", message: "transition_content requires a signed-in staff user", hint: "reason:sign_in_required" }, "unauthenticated", "sign_in_required"],
    [{ code: "P0002", message: "topic_version x not found", hint: "reason:not_found" }, "not_found", "not_found"],
    [{ code: "PT404", message: "topic_version x not found", hint: "reason:not_found" }, "not_found", "not_found"],
    [{ code: "PT404", message: "no hint from some other source" }, "not_found", undefined],
    [{ code: "42501", message: "new row violates row-level security policy for table \"topics\"" }, "forbidden", undefined],
    [{ code: "23505", message: "duplicate key value violates unique constraint" }, "conflict", undefined],
    [{ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, "not_found", undefined],
    [{ code: "PGRST301", message: "JWT expired" }, "unauthenticated", undefined],
    [{ code: "", message: "TypeError: fetch failed" }, "network", undefined],
    [{ code: "XX000", message: "something odd" }, "unknown", undefined],
  ];
  it.each(cases)("%o → %s/%s", (err, kind, reason) => {
    const e = toApiError(err);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.kind).toBe(kind);
    expect(e.reason).toBe(reason);
  });

  it("rewording a message does not change the outcome", () => {
    const a = toApiError({ code: "P0001", message: "3 of 4 claims lack a verified link to an active source", hint: "reason:claims_unverified" });
    const b = toApiError({ code: "P0001", message: "Evidence missing (reworded, or translated)", hint: "reason:claims_unverified" });
    expect([a.kind, a.reason]).toEqual([b.kind, b.reason]);
  });

  it("message wording alone never produces a reason", () => {
    const e = toApiError({ code: "P0001", message: "2 of 3 claims lack a verified link to an active source" });
    expect(e.reason).toBeUndefined();
    expect(e.kind).toBe("workflow_rule"); // still classified by SQLSTATE
  });

  it("an unknown reason from a newer server falls back to SQLSTATE", () => {
    const e = toApiError({ code: "42501", message: "x", hint: "reason:brand_new_rule" });
    expect([e.kind, e.reason]).toEqual(["forbidden", undefined]);
  });
});
