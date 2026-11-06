import { redirect } from "next/navigation";

// The dashboard is shared with supervisors, so it lives at /dashboard.
export default function AdminDashboardRedirect() {
  redirect("/dashboard");
}
