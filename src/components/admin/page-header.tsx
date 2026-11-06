import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional "← Back" link shown above the title. */
  back?: { href: string; label: string };
  /** Small line above the title (e.g. a reference number). */
  eyebrow?: React.ReactNode;
}

/** The one page header used across the app: back link, title (the page's h1), description, actions. */
export function PageHeader({ title, description, actions, back, eyebrow }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 print:hidden">{actions}</div>}
      </div>
    </div>
  );
}

/** "← Back" link with a full 44px tap target. */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground print:hidden",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden /> {label}
    </Link>
  );
}

interface EmptyStateProps {
  /** Short headline, e.g. "No assessments yet". */
  title?: string;
  /** Explanation / next step. */
  children?: React.ReactNode;
  /** A button or link that gets the user going. */
  action?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

/** Empty list or "no results": icon, headline, hint and (usually) one action. */
export function EmptyState({ title, children, action, icon: Icon = Inbox, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card/50 px-6 py-8 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
