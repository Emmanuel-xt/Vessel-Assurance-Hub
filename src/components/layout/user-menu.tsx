"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, LogOut, Shield } from "lucide-react";
import { useAuth, useCurrentUser } from "@/components/auth/auth-provider";
import { ROLE_ICONS } from "@/components/auth/demo-accounts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEMO_ACCOUNTS, DEMO_MODE } from "@/lib/config";
import { ROLE_LABELS } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { canAccessAdmin } from "@/lib/services/permissions";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function UserMenu() {
  const user = useCurrentUser();
  const { logOut, switchUser } = useAuth();
  const [switchError, setSwitchError] = useState<string | null>(null);

  async function demoAs(userId: string) {
    setSwitchError(null);
    try {
      await switchUser(userId);
    } catch (error) {
      setSwitchError(errorMessage(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`User menu for ${user.name}`}
        className="-mr-1.5 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-1.5 outline-none focus-visible:ring-3 focus-visible:ring-white"
      >
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-navy-foreground/70">{ROLE_LABELS[user.role]}</span>
        </span>
        <Avatar>
          <AvatarFallback className="bg-teal font-medium text-teal-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
              <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {user.position} · {user.company}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {canAccessAdmin(user) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/admin" />}>
              <Shield /> Admin
            </DropdownMenuItem>
          </>
        )}

        {DEMO_MODE && (
          <>
            <DropdownMenuSeparator />
            {/* MOCK: "Demo as" switcher for the showcase. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Demo as</DropdownMenuLabel>
              {DEMO_ACCOUNTS.map(({ userId, role, name }) => {
                const Icon = ROLE_ICONS[role];
                const current = userId === user.id;
                return (
                  <DropdownMenuItem key={userId} disabled={current} onClick={() => demoAs(userId)}>
                    <Icon />
                    <span className="flex-1">
                      {ROLE_LABELS[role]} <span className="text-muted-foreground">· {name}</span>
                    </span>
                    {current && <Check className="text-teal" />}
                  </DropdownMenuItem>
                );
              })}
              {switchError && <p className="px-2 py-1 text-xs text-destructive">{switchError}</p>}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logOut()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
