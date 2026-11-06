"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/status-screen";

// Unexpected error on a signed-in page. The top bar (from the layout) stays, so the user can still navigate.
export default function AppError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState onRetry={reset} />;
}
