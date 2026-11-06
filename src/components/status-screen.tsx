import Link from "next/link";
import { Compass, ShieldAlert, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-destructive/10 text-destructive",
};

interface StatusScreenProps {
  icon?: React.ElementType;
  tone?: Tone;
  /** Small label above the title, e.g. "Error 404". */
  eyebrow?: string;
  title: string;
  message: React.ReactNode;
  /** Buttons/links. Defaults to "Back to the hub". */
  actions?: React.ReactNode;
  className?: string;
}

/** Full-width message for "not found", "no access" and "something went wrong". Same look everywhere. */
export function StatusScreen({ icon: Icon = Compass, tone = "neutral", eyebrow, title, message, actions, className }: StatusScreenProps) {
  return (
    <section className={cn("mx-auto flex max-w-md flex-col items-center gap-3 px-2 py-14 text-center", className)}>
      <span className={cn("flex size-14 items-center justify-center rounded-2xl", TONES[tone])}>
        <Icon className="size-7" aria-hidden />
      </span>
      {eyebrow && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{eyebrow}</p>}
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <div className="text-sm text-muted-foreground">{message}</div>
      <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
        {actions ?? <HubLink />}
      </div>
    </section>
  );
}

export function HubLink({ variant = "default" }: { variant?: "default" | "outline" }) {
  return (
    <Link href="/" className={buttonVariants({ variant })}>
      Back to the hub
    </Link>
  );
}

export function NotFoundState({ what = "page", message }: { what?: string; message?: React.ReactNode }) {
  return (
    <StatusScreen
      eyebrow="Not found"
      title={`We couldn't find that ${what}`}
      message={message ?? `The link may be out of date, or the ${what} was removed.`}
    />
  );
}

export function NoAccessState({ message }: { message?: React.ReactNode }) {
  return (
    <StatusScreen
      icon={ShieldAlert}
      tone="danger"
      eyebrow="Not authorised"
      title="You don't have access to this page"
      message={message ?? "Ask an administrator if you think you should."}
    />
  );
}

export function ErrorState({ message, onRetry }: { message?: React.ReactNode; onRetry?: () => void }) {
  return (
    <StatusScreen
      icon={TriangleAlert}
      tone="warning"
      eyebrow="Something went wrong"
      title="This page didn't load"
      message={message ?? "Check your connection and try again. Your saved answers are safe."}
      actions={
        <>
          {onRetry && (
            <button type="button" onClick={onRetry} className={buttonVariants()}>
              Try again
            </button>
          )}
          <HubLink variant={onRetry ? "outline" : "default"} />
        </>
      }
    />
  );
}
