import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy strings with single spaces", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out false, null, undefined, and empty strings", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("returns an empty string when given no truthy values", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});
