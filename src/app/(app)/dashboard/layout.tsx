import { RequireRole } from "@/components/auth/guards";
import { DASHBOARD_ROLES } from "@/lib/services/permissions";

// Supervisors and auditors see a read-only dashboard; admins see everything (CLAUDE.md §10). Visitors do not.
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireRole roles={[...DASHBOARD_ROLES]} message="The dashboard is for supervisors, auditors and admins.">
      {children}
    </RequireRole>
  );
}
