"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ListChecks,
  MapPin,
  Menu,
  Settings,
  Ship,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { users } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/vessels", label: "Vessels", icon: Ship },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/modules", label: "Modules", icon: Boxes },
  { href: "/admin/questions", label: "Questions", icon: ListChecks },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function usePendingCount(): number {
  const pending = useRepoQuery(["users", { status: "PENDING" }], () => users.list({ status: "PENDING" }));
  return pending.data?.length ?? 0;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const pendingCount = usePendingCount();

  return (
    <nav aria-label="Admin" className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-navy text-navy-foreground" : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className={cn("size-4", active ? "text-teal" : "text-muted-foreground")} aria-hidden />
            <span className="flex-1">{label}</span>
            {href === "/admin/users" && pendingCount > 0 && (
              <Badge className="bg-teal text-teal-foreground" aria-label={`${pendingCount} awaiting approval`}>
                {pendingCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Admin layout: sidebar on desktop, a "Menu" sheet on phones. */
export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8">
      <aside className="hidden md:block">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
        <NavLinks />
      </aside>

      <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
        <p className="text-sm text-muted-foreground">
          Admin <span aria-hidden>›</span> <span className="font-medium text-foreground">{current?.label}</span>
        </p>
        <Button variant="outline" className="h-10" onClick={() => setMenuOpen(true)}>
          <Menu /> Menu
        </Button>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 p-4">
            <SheetHeader className="p-0">
              <SheetTitle>Admin</SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
