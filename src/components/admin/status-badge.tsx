import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES = {
  positive: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  muted: "bg-muted text-muted-foreground",
} as const;

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  ACTIVE: "positive",
  PENDING: "warning",
  DISABLED: "muted",
  INACTIVE: "muted",
  DRAFT: "warning",
  SUBMITTED: "positive",
  OPEN: "warning",
  IN_PROGRESS: "warning",
  CLOSED: "positive",
};

const LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  DISABLED: "Disabled",
  INACTIVE: "Inactive",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  CLOSED: "Closed",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn(TONES[STATUS_TONE[status] ?? "muted"])}>{LABELS[status] ?? status}</Badge>;
}

/** For records with an `active` flag. */
export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge status={active ? "ACTIVE" : "INACTIVE"} />;
}
