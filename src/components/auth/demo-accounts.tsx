"use client";

// MOCK: one-click demo logins for the showcase. Only rendered when NEXT_PUBLIC_DEMO_MODE=true.

import { useState } from "react";
import { HardHat, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACCOUNTS, DEMO_MODE } from "@/lib/config";
import { ROLE_LABELS } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import type { Role } from "@/lib/types";
import { useAuth } from "./auth-provider";

export const ROLE_ICONS: Record<Role, React.ElementType> = {
  ADMIN: ShieldCheck,
  SUPERVISOR: UserCog,
  WORKER: HardHat,
};

export function DemoAccounts() {
  const { switchUser } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!DEMO_MODE) return null;

  async function quickLogin(userId: string) {
    setError(null);
    setPendingId(userId);
    try {
      await switchUser(userId);
    } catch (e) {
      setError(errorMessage(e));
      setPendingId(null);
    }
  }

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader>
        <CardTitle>Demo accounts</CardTitle>
        <CardDescription>One-click login for the showcase. Every demo password is demo1234.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {DEMO_ACCOUNTS.map(({ userId, role, name }) => {
          const Icon = ROLE_ICONS[role];
          return (
            <Button
              key={userId}
              variant="outline"
              className="h-12 w-full justify-start gap-3"
              disabled={pendingId !== null}
              onClick={() => quickLogin(userId)}
            >
              <Icon className="text-teal" />
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <span className="truncate text-muted-foreground">{pendingId === userId ? "Logging in…" : name}</span>
            </Button>
          );
        })}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
