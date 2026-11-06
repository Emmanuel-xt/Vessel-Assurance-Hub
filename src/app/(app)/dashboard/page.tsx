import { Suspense } from "react";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export const metadata = { title: "Dashboard" };

// Access (supervisors and admins) is checked in ./layout.tsx.
export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardScreen />
    </Suspense>
  );
}
