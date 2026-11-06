import { RequireAuth } from "@/components/auth/guards";
import { TopBar } from "@/components/layout/top-bar";

// Layout for every signed-in page (hub, modules, findings, dashboard, admin).
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </RequireAuth>
  );
}
