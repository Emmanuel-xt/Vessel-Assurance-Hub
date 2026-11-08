import { describe, expect, it } from "vitest";
import { safeNextPath } from "./navigation";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeNextPath("/assessments?view=all#top")).toBe("/assessments?view=all#top");
    expect(safeNextPath("/admin/users")).toBe("/admin/users");
  });

  it("falls back to the hub for anything else", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "/\tevil",
      "/\n/evil.example",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("leaves percent-encoded text alone (it stays a path)", () => {
    expect(safeNextPath("/%5Cevil")).toBe("/%5Cevil");
  });
});
