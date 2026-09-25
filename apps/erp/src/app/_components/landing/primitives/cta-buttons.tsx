import Link from "next/link";

import { cn } from "@cendaro/ui";
import { buttonVariants } from "@cendaro/ui/button";
import { Icons } from "@cendaro/ui/icons";

import { accessRequestLinks } from "~/lib/site-env";
import { WhatsAppMark } from "./whatsapp-mark";

interface CtaButtonsProps {
  /** Where the visitor is (sent in the prefilled message), e.g. "Plan Pro". */
  context?: string;
  align?: "center" | "start";
  /** Show "Iniciar sesión" next to the primary action. */
  showLogin?: boolean;
  /** Show "o escríbenos a …" under the buttons when both channels exist. */
  showEmailHint?: boolean;
  /** Full-width buttons (pricing columns, mobile menu). */
  block?: boolean;
  className?: string;
}

const PRIMARY = cn(
  buttonVariants({ size: "lg" }),
  "h-11 px-6 transition-[background-color,transform] duration-(--motion-micro) active:translate-y-px",
);
const SECONDARY = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "h-11 px-6 transition-[background-color,transform] duration-(--motion-micro) active:translate-y-px",
);

function emailAddress(mailto: string): string {
  return decodeURIComponent(mailto.slice("mailto:".length).split("?")[0] ?? "");
}

/**
 * "Solicitar acceso" (user decision D2/D3, 2026-09-24): WhatsApp first, email
 * as fallback, nothing stored. With neither configured
 * (NEXT_PUBLIC_CONTACT_WHATSAPP / NEXT_PUBLIC_CONTACT_EMAIL unset) the
 * request button is omitted and "Iniciar sesión" becomes the primary action.
 */
export function CtaButtons({
  context,
  align = "center",
  showLogin = true,
  showEmailHint = false,
  block = false,
  className,
}: CtaButtonsProps) {
  const { whatsapp, email } = accessRequestLinks(context);
  const request = whatsapp ?? email;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-3 sm:flex-row",
          align === "center" ? "sm:justify-center" : "sm:justify-start",
          !block && "sm:w-auto",
        )}
      >
        {request ? (
          <a
            href={request}
            {...(whatsapp
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={cn(PRIMARY, block && "w-full")}
          >
            {whatsapp ? <WhatsAppMark /> : <Icons.Mail />}
            Solicitar acceso
            {whatsapp ? <span className="sr-only">(abre WhatsApp)</span> : null}
          </a>
        ) : null}
        {showLogin || !request ? (
          <Link
            href="/login"
            className={cn(request ? SECONDARY : PRIMARY, block && "w-full")}
          >
            Iniciar sesión
          </Link>
        ) : null}
      </div>
      {showEmailHint && whatsapp && email ? (
        <p className="text-muted-foreground text-sm">
          o escríbenos a{" "}
          <a
            href={email}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {emailAddress(email)}
          </a>
        </p>
      ) : null}
    </div>
  );
}
