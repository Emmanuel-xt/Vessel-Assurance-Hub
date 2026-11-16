import { RequireRole } from "@/components/auth/guards";
import { ActivitySetup } from "@/components/start-work/activity-setup";

export const metadata = { title: "New Start Work Check" };

// Auditors (and admins) set up Start Work Checks; the service checks the role again.
export default function NewStartWorkPage() {
  return (
    <RequireRole roles={["AUDITOR", "ADMIN"]} message="Start Work Checks are set up by auditors. Ask yours for the code.">
      <ActivitySetup />
    </RequireRole>
  );
}
