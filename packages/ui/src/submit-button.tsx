import type { VariantProps } from "class-variance-authority";

import { cn } from "@cendaro/ui";

import type { buttonVariants } from "./button";
import { Button } from "./button";
import { Spinner } from "./spinner";

/** Button that shows a centered Spinner (text kept invisible, not removed —
 * layout never shifts) while `loading` is true. */
function SubmitButton({
  loading = false,
  disabled,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  return (
    <Button
      disabled={disabled ?? loading}
      className={cn("relative", className)}
      {...props}
    >
      <span className={loading ? "invisible" : undefined}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={16} />
        </span>
      )}
    </Button>
  );
}

export { SubmitButton };
