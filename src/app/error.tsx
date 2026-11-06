"use client";

import { useEffect } from "react";
import { Wordmark } from "@/components/brand/logo";
import { ErrorState } from "@/components/status-screen";

// Unexpected error outside the signed-in layout (login, signup) or in a layout itself.
export default function RootError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <ErrorState onRetry={reset} />
      </main>
    </>
  );
}
