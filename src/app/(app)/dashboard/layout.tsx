import { RequireRole } from "@/components/auth/guards";

// Supervisors see a read-only dashboard; admins see everything (CLAUDE.md §10).
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireRole roles={["SUPERVISOR", "ADMIN"]} message="The dashboard is for supervisors and admins.">
      {children}
    </RequireRole>
  );
}
