import { describe, expect, it } from "vitest";
import { safeAuthNext } from "../lib/auth-redirect";

describe("auth return destinations", () => {
  it("preserves local destinations and their queries", () => {
    expect(safeAuthNext("/en/onboarding?from=signup", "en")).toBe("/en/onboarding?from=signup");
    expect(safeAuthNext("/ar/reset-password", "ar")).toBe("/ar/reset-password");
  });
  it("rejects external URLs, traversal, backslashes, and wrong locales", () => {
    for (const value of [undefined, "https://evil.test", "//evil.test", "/en/../../outside", "/en/\\evil.test", "/ar/home", "/en/%2e%2e/outside"]) {
      expect(safeAuthNext(value, "en")).toBe("/en/home");
    }
  });
});
