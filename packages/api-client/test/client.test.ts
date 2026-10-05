import { describe, expect, it } from "vitest";
import { examples } from "@dental/content-schema";
import {
  ApiError, getTopic, getVersionConsumers, recordProgress, saveBlock, setMyInterests, transition, updateMyProfile,
} from "../src";
import { fakeClient } from "./helpers";

const err = (code: string, message: string, hint?: string) => ({ data: null, error: { code, message, hint } });

describe("workflow", () => {
  it("transition sends the exact RPC arguments", async () => {
    const { client, log } = fakeClient({ "rpc:transition_content": { data: "source_verified", error: null } });
    await expect(transition(client, "question_version", "qv1", "source_verified")).resolves.toBe("source_verified");
    expect(log[0]).toEqual({ target: "rpc:transition_content", calls: [["rpc", [
      { p_entity_type: "question_version", p_entity_id: "qv1", p_to: "source_verified", p_note: undefined },
    ]]] });
  });
  it("transition surfaces workflow reasons", async () => {
    const { client } = fakeClient({ "rpc:transition_content": err("P0001", "1 of 2 claims lack a verified link to an active source", "reason:claims_unverified") });
    await expect(transition(client, "topic_version", "v1", "source_verified"))
      .rejects.toMatchObject({ kind: "workflow_rule", reason: "claims_unverified" });
  });
});

describe("saveBlock", () => {
  it("never sends invalid content", async () => {
    const { client, log } = fakeClient({});
    const bad = structuredClone(examples.warning.content) as any; bad.shared.severity = "info";
    await expect(saveBlock(client, "v1", { type: "warning", position: 0, content: bad }))
      .rejects.toMatchObject({ kind: "content_invalid" });
    expect(log).toHaveLength(0);
  });
  it("inserts parsed content with schema defaults made explicit", async () => {
    const { client, log } = fakeClient({ topic_blocks: { data: { id: "b1" }, error: null } });
    const content = structuredClone(examples.illustration.content) as any;
    delete content.shared.aspect; delete content.shared.zoomable;
    await saveBlock(client, "v1", { type: "illustration", position: 2, content });
    const insert = log[0]!.calls.find(([m]) => m === "insert")![1][0] as any;
    expect(insert).toMatchObject({ topic_version_id: "v1", type: "illustration", schema_version: 1, position: 2 });
    expect(insert.content.shared).toMatchObject({ aspect: "auto", zoomable: true });
  });
  it("updates when an id is given", async () => {
    const { client, log } = fakeClient({ topic_blocks: { data: { id: "b1" }, error: null } });
    await saveBlock(client, "v1", { id: "b1", type: "text", position: 1, content: examples.text.content });
    expect(log[0]!.calls.map(([m]) => m)).toEqual(["update", "eq", "select", "single"]);
  });
});

describe("catalog", () => {
  it("getTopic returns null when the topic is not listed", async () => {
    const { client } = fakeClient({ "rpc:get_topic_bundle": { data: null, error: null } });
    await expect(getTopic(client, "endodontics", "missing")).resolves.toBeNull();
  });
});

describe("embed traceability", () => {
  it("a version that is not live has no consumers", async () => {
    const { client } = fakeClient({
      question_versions: { data: { question_id: "q1" }, error: null },
      questions: { data: { published_version_id: "qv2" }, error: null },
    });
    await expect(getVersionConsumers(client, "question", "qv1")).resolves.toEqual({ identityId: "q1", isLive: false, consumers: [] });
  });
  it("the live version is consumed by published topic versions embedding its identity", async () => {
    const { client, log } = fakeClient({
      question_versions: { data: { question_id: "q1" }, error: null },
      questions: { data: { published_version_id: "qv2" }, error: null },
      topic_blocks: { data: [{ id: "b1", topic_version_id: "tv1" }, { id: "b2", topic_version_id: "tv-draft" }], error: null },
      topic_versions: { data: [{ id: "tv1", topic_id: "t1", version_no: 3 }], error: null }, // filtered to published
      topics: { data: [{ id: "t1", slug: "pulp-anatomy" }], error: null },
    });
    const r = await getVersionConsumers(client, "question", "qv2");
    expect(r).toEqual({ identityId: "q1", isLive: true, consumers: [
      { topicId: "t1", topicSlug: "pulp-anatomy", topicVersionId: "tv1", topicVersionNo: 3, blockId: "b1" },
    ] });
    const blocksQuery = log.find((l) => l.target === "topic_blocks")!.calls;
    expect(blocksQuery).toContainEqual(["contains", ["content", { shared: { question_ids: ["q1"] } }]]);
    expect(log.find((l) => l.target === "topic_versions")!.calls).toContainEqual(["eq", ["status", "published"]]);
  });
});

describe("learner data", () => {
  it("profile input is validated before any write", async () => {
    const { client, log } = fakeClient({});
    await expect(updateMyProfile(client, { role: "dean" } as any)).rejects.toMatchObject({ kind: "invalid_input" });
    expect(log).toHaveLength(0);
  });
  it("completing onboarding stamps onboarded_at", async () => {
    const { client, log } = fakeClient({ profiles: { data: { id: "u1" }, error: null } });
    await updateMyProfile(client, { role: "student", preferred_locale: "ar" }, { completeOnboarding: true });
    const patch = log[0]!.calls.find(([m]) => m === "update")![1][0] as any;
    expect(patch).toMatchObject({ role: "student", preferred_locale: "ar" });
    expect(typeof patch.onboarded_at).toBe("string");
  });
  it("signed-out calls fail as unauthenticated", async () => {
    const { client } = fakeClient({}, null);
    await expect(updateMyProfile(client, { role: "student" })).rejects.toMatchObject({ kind: "unauthenticated" });
  });
  it("clearing interests deletes all, inserts none", async () => {
    const { client, log } = fakeClient({});
    await setMyInterests(client, []);
    expect(log.map((l) => l.target)).toEqual(["user_interests"]);
    expect(log[0]!.calls.map(([m]) => m)).toEqual(["delete", "eq"]);
  });
  it("progress percent is clamped and rounded", async () => {
    const { client, log } = fakeClient({ "rpc:upsert_progress": { data: {}, error: null } });
    await recordProgress(client, { topicId: "t1", percent: 133.7 });
    expect((log[0]!.calls[0]![1][0] as any).p_percent).toBe(100);
  });
});

it("ApiError is a real Error", () => {
  expect(new ApiError({ kind: "unknown", message: "x" })).toBeInstanceOf(Error);
});
