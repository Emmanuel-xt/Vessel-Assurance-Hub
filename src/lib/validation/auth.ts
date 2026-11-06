// Form validation for signup and login. Shared by the UI today and a real API later.

import { z } from "zod";
import { SELF_SIGNUP_ROLES } from "@/lib/services/permissions";

export { fieldErrors, type FieldErrors } from "./common";

export const PASSWORD_MIN_LENGTH = 8;

export const loginSchema = z.object({
  email: z.string().trim().min(1, { error: "Enter your email" }).pipe(z.email({ error: "Enter a valid email" })),
  password: z.string().min(1, { error: "Enter your password" }),
});

const passwordPair = z.object({ password: z.string(), confirmPassword: z.string().min(1) });

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Enter your full name" }).max(100),
    email: z.string().trim().min(1, { error: "Enter your email" }).pipe(z.email({ error: "Enter a valid email" })),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, { error: `Use at least ${PASSWORD_MIN_LENGTH} characters` })
      .max(128),
    confirmPassword: z.string().min(1, { error: "Confirm your password" }),
    company: z.string().trim().min(2, { error: "Enter your company" }).max(100),
    position: z.string().trim().min(2, { error: "Choose or enter your position" }).max(100),
    requestedRole: z.enum(SELF_SIGNUP_ROLES, { error: "Choose a role" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
    // Check the match even while other fields are invalid, so every problem shows at once.
    when: (payload) => passwordPair.safeParse(payload.value).success,
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
