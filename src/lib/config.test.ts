import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/config";

// Smoke test: proves Vitest runs and the "@/" import alias resolves.
describe("config", () => {
  it("exposes the app name", () => {
    expect(APP_NAME).toBe("Vessel Assurance Hub");
  });
});
