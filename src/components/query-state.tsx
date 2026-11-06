"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { RotateCw, TriangleAlert } from "lucide-react";
import { NoAccessState, NotFoundState } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

interface QueryStateProps<T> {
  query: UseQueryResult<T, Error>;
  children: (data: T) => React.ReactNode;
  /** Shown while loading. Defaults to skeleton rows. */
  loading?: React.ReactNode;
  /** Number of skeleton rows for the default loading state. */
  skeletonRows?: number;
  /** What a NOT_FOUND error is about, e.g. "assessment" ("We couldn't find that assessment"). */
  notFound?: string;
}

/** Repository and permission errors carry a `code` (RepositoryError / PermissionError). */
function errorCode(error: Error): string | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Placeholder rows shaped like the lists and cards they stand in for. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Standard loading, error and success rendering for any useRepoQuery result. */
export function QueryState<T>({ query, children, loading, skeletonRows = 3, notFound }: QueryStateProps<T>) {
  if (query.isPending) return loading ?? <Skeleton rows={skeletonRows} />;

  if (query.isError) {
    const code = errorCode(query.error);
    if (code === "NOT_FOUND") return <NotFoundState what={notFound ?? "page"} message={notFound ? query.error.message : undefined} />;
    if (code === "FORBIDDEN") return <NoAccessState message={query.error.message} />;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <TriangleAlert className="size-4" aria-hidden />
          Couldn&apos;t load this
        </div>
        <p className="text-sm text-muted-foreground">{query.error.message}</p>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RotateCw className={query.isFetching ? "animate-spin" : undefined} /> {query.isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  return <>{children(query.data)}</>;
}
