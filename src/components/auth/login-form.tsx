"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, LogIn, UserX } from "lucide-react";
import { FormField, INPUT_CLASS, fieldA11y } from "@/components/forms/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RepositoryError } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { fieldErrors, loginSchema, type FieldErrors, type LoginValues } from "@/lib/validation/auth";
import { useAuth } from "./auth-provider";

const STATUS_ALERTS = {
  PENDING_APPROVAL: { title: "Awaiting approval", icon: Clock },
  ACCOUNT_DISABLED: { title: "Account disabled", icon: UserX },
  INVALID_CREDENTIALS: { title: "Could not log in", icon: AlertCircle },
} as const;

type AlertState = { title: string; message: string; icon: React.ElementType };

export function LoginForm() {
  const { logIn } = useAuth();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof LoginValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await logIn(parsed.data.email, parsed.data.password);
      // The (auth) layout redirects once the session is set.
    } catch (error) {
      const known = error instanceof RepositoryError && error.code in STATUS_ALERTS
        ? STATUS_ALERTS[error.code as keyof typeof STATUS_ALERTS]
        : { title: "Could not log in", icon: AlertCircle };
      setAlert({ ...known, message: errorMessage(error) });
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl"><h1>Log in</h1></CardTitle>
        <CardDescription>Use the email and password you signed up with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {alert && (
            <Alert variant="destructive">
              <alert.icon />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          )}
          <FormField id="email" label="Email" error={errors.email}>
            <Input
              {...fieldA11y("email", errors.email)}
              type="email"
              autoComplete="email"
              inputMode="email"
              className={INPUT_CLASS}
              value={values.email}
              onChange={update("email")}
            />
          </FormField>
          <FormField id="password" label="Password" error={errors.password}>
            <Input
              {...fieldA11y("password", errors.password)}
              type="password"
              autoComplete="current-password"
              className={INPUT_CLASS}
              value={values.password}
              onChange={update("password")}
            />
          </FormField>
          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            <LogIn /> {submitting ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="font-medium text-teal underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
