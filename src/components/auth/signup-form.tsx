"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, HardHat, UserCog, UserPlus } from "lucide-react";
import { FormField, INPUT_CLASS, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/data";
import { RepositoryError } from "@/lib/data/repositories";
import { OTHER_POSITION, POSITIONS, ROLE_LABELS } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { SELF_SIGNUP_ROLES } from "@/lib/services/permissions";
import {
  PASSWORD_MIN_LENGTH,
  fieldErrors,
  signupSchema,
  type FieldErrors,
  type SignupValues,
} from "@/lib/validation/auth";

type FormValues = Omit<SignupValues, "requestedRole"> & {
  requestedRole: SignupValues["requestedRole"] | "";
  positionChoice: string;
};

const EMPTY: FormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  company: "",
  position: "",
  positionChoice: "",
  requestedRole: "",
};

const ROLE_OPTIONS = {
  WORKER: { icon: HardHat, description: "Self assessments and start work checks." },
  SUPERVISOR: { icon: UserCog, description: "Adds MFE, spot checks and verifications." },
} as const;

export function SignupForm() {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<SignupValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(field: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [field]: value }));
  const onInput = (field: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    set(field, event.target.value);

  function choosePosition(choice: string) {
    setValues((v) => ({ ...v, positionChoice: choice, position: choice === OTHER_POSITION ? "" : choice }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { name, email, password, company, position, requestedRole } = parsed.data;
      const user = await auth.signUp({ name, email, password, company, position, requestedRole });
      setSubmittedName(user.name);
    } catch (error) {
      if (error instanceof RepositoryError && error.code === "CONFLICT") {
        setErrors({ email: "An account with this email already exists. Try logging in." });
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedName) {
    return (
      <Card>
        <CardHeader>
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Clock className="size-6" aria-hidden />
          </span>
          <CardTitle className="text-xl"><h1>Your account is awaiting approval</h1></CardTitle>
          <CardDescription>
            Thanks, {submittedName}. An administrator will review your request. You can log in once it is approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={cn(buttonVariants(), "h-11 w-full")}>
            Back to log in
          </Link>
        </CardContent>
      </Card>
    );
  }

  const showOther = values.positionChoice === OTHER_POSITION;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl"><h1>Create an account</h1></CardTitle>
        <CardDescription>An administrator approves every new account before first login.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Could not create your account</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <FormField id="name" label="Full name" error={errors.name}>
            <Input {...fieldA11y("name", errors.name)} autoComplete="name" className={INPUT_CLASS} value={values.name} onChange={onInput("name")} />
          </FormField>

          <FormField id="email" label="Email" error={errors.email}>
            <Input
              {...fieldA11y("email", errors.email)}
              type="email"
              autoComplete="email"
              inputMode="email"
              className={INPUT_CLASS}
              value={values.email}
              onChange={onInput("email")}
            />
          </FormField>

          <FormField id="password" label="Password" error={errors.password} hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
            <Input
              {...fieldA11y("password", errors.password)}
              type="password"
              autoComplete="new-password"
              className={INPUT_CLASS}
              value={values.password}
              onChange={onInput("password")}
            />
          </FormField>

          <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
            <Input
              {...fieldA11y("confirmPassword", errors.confirmPassword)}
              type="password"
              autoComplete="new-password"
              className={INPUT_CLASS}
              value={values.confirmPassword}
              onChange={onInput("confirmPassword")}
            />
          </FormField>

          <FormField id="company" label="Company" error={errors.company}>
            <Input
              {...fieldA11y("company", errors.company)}
              autoComplete="organization"
              className={INPUT_CLASS}
              value={values.company}
              onChange={onInput("company")}
            />
          </FormField>

          <FormField id="positionChoice" label="Position" error={showOther ? undefined : errors.position}>
            <NativeSelect
              {...fieldA11y("positionChoice", showOther ? undefined : errors.position)}
              value={values.positionChoice}
              onChange={(event) => choosePosition(event.target.value)}
            >
              <option value="" disabled>
                Choose your position
              </option>
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
              <option value={OTHER_POSITION}>Other…</option>
            </NativeSelect>
          </FormField>

          {showOther && (
            <FormField id="position" label="Your position" error={errors.position}>
              <Input
                {...fieldA11y("position", errors.position)}
                autoComplete="organization-title"
                className={INPUT_CLASS}
                value={values.position}
                onChange={onInput("position")}
              />
            </FormField>
          )}

          <fieldset className="space-y-1.5" aria-describedby={errors.requestedRole ? "requestedRole-error" : undefined}>
            <legend className="text-sm font-medium">Requested role</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SELF_SIGNUP_ROLES.map((role) => {
                const { icon: Icon, description } = ROLE_OPTIONS[role];
                const selected = values.requestedRole === role;
                return (
                  <label
                    key={role}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      selected ? "border-teal bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="requestedRole"
                      value={role}
                      checked={selected}
                      onChange={() => set("requestedRole", role)}
                      className="mt-1 accent-[var(--teal)]"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-4 text-teal" aria-hidden /> {ROLE_LABELS[role]}
                      </span>
                      <span className="text-xs text-muted-foreground">{description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.requestedRole && (
              <p id="requestedRole-error" className="text-sm text-destructive">
                {errors.requestedRole}
              </p>
            )}
          </fieldset>

          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            <UserPlus /> {submitting ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-teal underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
