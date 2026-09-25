import Image from "next/image";
import Link from "next/link";

import { cn } from "@cendaro/ui";
import { buttonVariants } from "@cendaro/ui/button";

import { accessRequestLinks } from "~/lib/site-env";
import { MobileMenu } from "./mobile-menu";
import { NAV_LINKS } from "./nav-links";
import { NavScrollState } from "./nav-scroll-state";
import { ThemeToggle } from "./theme-toggle";

const HEADER_ID = "cabecera";

/**
 * Public header (plan T4.1): server shell; only the scroll state, the theme
 * switch and the phone menu are client islands. Transparent at the top,
 * solid background + hairline once scrolled (`data-scrolled`).
 */
export function Navbar() {
  const { whatsapp, email } = accessRequestLinks("Menú");
  const request = whatsapp ?? email;

  return (
    <header
      id={HEADER_ID}
      className="safe-pt data-scrolled:bg-background/90 data-scrolled:border-border fixed inset-x-0 top-0 z-50 border-b border-transparent transition-[background-color,border-color] duration-(--motion-ui) data-scrolled:backdrop-blur-md"
    >
      <NavScrollState targetId={HEADER_ID} />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Cendaro — inicio"
          className="focus-visible:ring-ring flex items-center gap-2 outline-none focus-visible:ring-1"
        >
          <Image
            src="/cendaro-logo.png"
            alt=""
            width={28}
            height={28}
            priority
            className="size-7 invert dark:invert-0"
          />
          <span className="text-lg font-medium tracking-tight">Cendaro</span>
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring px-3 py-2 text-sm transition-colors duration-(--motion-micro) outline-none focus-visible:ring-1"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 md:gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring hidden px-3 py-2 text-sm transition-colors duration-(--motion-micro) outline-none focus-visible:ring-1 md:block"
          >
            Iniciar sesión
          </Link>
          {request ? (
            <a
              href={request}
              {...(whatsapp
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className={cn(buttonVariants(), "hidden md:inline-flex")}
            >
              Solicitar acceso
            </a>
          ) : null}
          <MobileMenu
            requestHref={request}
            requestIsWhatsApp={Boolean(whatsapp)}
          />
        </div>
      </div>
    </header>
  );
}
