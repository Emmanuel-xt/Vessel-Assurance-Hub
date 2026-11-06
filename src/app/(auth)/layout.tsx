import { Wordmark } from "@/components/brand/logo";
import { RedirectIfAuthenticated } from "@/components/auth/guards";

// Layout for signed-out pages (login, signup). Signed-in users are sent on to the hub.
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-navy px-4 py-10 text-navy-foreground">
      <Wordmark className="mb-6" size="lg" />
      <div className="w-full max-w-sm">
        <RedirectIfAuthenticated>{children}</RedirectIfAuthenticated>
      </div>
    </main>
  );
}
