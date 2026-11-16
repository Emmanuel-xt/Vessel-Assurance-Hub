"use client";

import Link from "next/link";
import { HardHat } from "lucide-react";
import { startWorkActivities } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import type { ID } from "@/lib/types";

/** "Part of Start Work Check VAH-S-…" link from a participant's check to the auditor's activity. */
export function ActivityLink({ activityId }: { activityId: ID }) {
  const activity = useRepoQuery(["startWorkActivities", activityId], () => startWorkActivities.get(activityId));
  return (
    <Link
      href={`/start-work/${activityId}`}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-teal hover:underline print:min-h-0"
    >
      <HardHat className="size-4 shrink-0" aria-hidden />
      Part of Start Work Check {activity.data?.reference ?? "…"}
      {activity.data && <span className="font-normal text-muted-foreground">· set up by {activity.data.snapshot.createdByName}</span>}
    </Link>
  );
}
