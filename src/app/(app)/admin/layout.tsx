import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/auth/guards";

// Every page under /admin requires the ADMIN role.
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireRole roles={["ADMIN"]}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
