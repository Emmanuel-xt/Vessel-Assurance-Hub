import { describe, expect, it } from "vitest";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation/auth";

const VALID = {
  name: "Ada Obi",
  email: "ada.obi@example.com",
  password: "longenough",
  confirmPassword: "longenough",
  company: "Deltaport Crewing",
  position: "Crew Member",
  requestedRole: "WORKER",
};

describe("signupSchema", () => {
  it("accepts a complete form and trims text", () => {
    const result = signupSchema.safeParse({ ...VALID, name: "  Ada Obi  " });
    expect(result.success && result.data.name).toBe("Ada Obi");
  });

  it("reports one message per invalid field", () => {
    const result = signupSchema.safeParse({
      ...VALID,
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
      requestedRole: "ADMIN",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({
      email: "Enter a valid email",
      password: "Use at least 8 characters",
      confirmPassword: "Passwords do not match",
      requestedRole: "Choose a role",
    });
  });

  it("requires every field", () => {
    const result = signupSchema.safeParse({ ...VALID, company: "", position: "", requestedRole: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(["company", "position", "requestedRole"]);
  });
});

describe("loginSchema", () => {
  it("asks for both fields", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({ email: "Enter your email", password: "Enter your password" });
  });
});
