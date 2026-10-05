import { describe, expect, it } from "vitest";
import { NAV_ITEMS, activeNavKey, isActive, parentPath } from "../components/shell/nav-config";

describe("nav config", () => {
  it("has exactly the five approved areas, in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["home", "learn", "practice", "clinical", "profile"]);
  });
  it.each([
    ["/learn", "/learn", true],
    ["/learn/endodontics", "/learn", true],
    ["/learning", "/learn", false], // prefix of a different word is not active
    ["/home", "/learn", false],
  ])("isActive(%s, %s) = %s", (path, href, expected) => expect(isActive(path, href)).toBe(expected));
  it("nested pages keep their area active", () => {
    expect(activeNavKey("/learn/endodontics/pulp-anatomy")).toBe("learn");
    expect(activeNavKey("/nowhere")).toBeUndefined();
  });
});

describe("back button target", () => {
  it.each([
    ["/learn", null],
    ["/home", null],
    ["/learn/endodontics", "/learn"],
    ["/learn/endodontics/pulp-anatomy", "/learn/endodontics"],
    ["/learn/endodontics/", "/learn"],
  ])("parentPath(%s) = %s", (path, expected) => expect(parentPath(path)).toBe(expected));
});
