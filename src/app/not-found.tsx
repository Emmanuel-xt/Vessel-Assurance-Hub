import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NotFoundState } from "@/components/status-screen";

export const metadata = { title: "Page not found" };

// Any unknown URL. Works signed in or out ("Back to the hub" goes to login when signed out).
export default function NotFound() {
  return (
    <>
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
          <Link href="/" className="flex min-h-11 items-center rounded-md">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <NotFoundState message="The link may be out of date, or the address was typed incorrectly." />
      </main>
    </>
  );
}
