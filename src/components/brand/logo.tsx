import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * App mark: a check inside a shield on a teal tile. Generic on purpose: no client name or logo (CLAUDE.md §15).
 * The same drawing is used for the favicon and app icons (src/app/icon.svg, public/icons/).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--teal)" />
      <path
        d="M16 5.5 24.5 8.6v6.7c0 5.2-3.5 9.3-8.5 11.2-5-1.9-8.5-6-8.5-11.2V8.6Z"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m11.8 15.9 3.1 3.1 5.6-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "Vessel Assurance Hub" wordmark. Inherits the text colour of its container. */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark className={size === "lg" ? "size-10" : "size-8"} />
      <span className={cn("truncate font-semibold tracking-tight", size === "lg" ? "text-lg" : "text-base")}>{APP_NAME}</span>
    </span>
  );
}
