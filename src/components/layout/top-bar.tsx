import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { UserMenu } from "@/components/layout/user-menu";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 bg-navy text-navy-foreground shadow-sm print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-h-11 min-w-0 items-center rounded-md">
          <Wordmark />
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
