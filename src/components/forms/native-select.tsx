import { cn } from "@/lib/utils";
import { INPUT_CLASS } from "./form-field";

/** Native <select>: the best picker on phones. Styled to match the shadcn inputs. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        INPUT_CLASS,
        "min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}
