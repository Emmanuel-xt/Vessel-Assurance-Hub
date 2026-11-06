import { DemoDataPanel } from "@/components/admin/demo-data-panel";
import { PageHeader } from "@/components/admin/page-header";
import { DEMO_MODE } from "@/lib/config";

export const metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      {DEMO_MODE ? (
        <DemoDataPanel />
      ) : (
        <p className="text-sm text-muted-foreground">No settings available.</p>
      )}
    </div>
  );
}
