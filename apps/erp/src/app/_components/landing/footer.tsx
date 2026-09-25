import Image from "next/image";
import Link from "next/link";

import { accessRequestLinks } from "~/lib/site-env";
import { NAV_LINKS } from "./nav/nav-links";
import { ThemeToggle } from "./nav/theme-toggle";

/**
 * Public footer (plan §6.1 #13): only real links — no dead "#", no invented
 * social profiles or compliance seals — and the giant wordmark.
 */
export function Footer() {
  const { whatsapp, email } = accessRequestLinks("Pie de página");

  return (
    <footer className="border-border overflow-hidden border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-16 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div>
          <Link
            href="/"
            aria-label="Cendaro — inicio"
            className="flex items-center gap-2"
          >
            <Image
              src="/cendaro-logo.png"
              alt=""
              width={24}
              height={24}
              className="size-6 invert dark:invert-0"
            />
            <span className="font-medium">Cendaro</span>
          </Link>
          <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
            El sistema de gestión para distribuidoras y comercios en Venezuela.
            Hecho en Venezuela.
          </p>
        </div>

        <nav aria-labelledby="pie-producto">
          <h2 id="pie-producto" className="text-sm font-medium">
            Producto
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors duration-(--motion-micro)"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="pie-contacto">
          <h2 id="pie-contacto" className="text-sm font-medium">
            Contacto
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {whatsapp ? (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors duration-(--motion-micro)"
                >
                  WhatsApp
                </a>
              </li>
            ) : null}
            {email ? (
              <li>
                <a
                  href={email}
                  className="text-muted-foreground hover:text-foreground transition-colors duration-(--motion-micro)"
                >
                  Correo
                </a>
              </li>
            ) : null}
            <li>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground transition-colors duration-(--motion-micro)"
              >
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="safe-pb mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="border-border flex items-center justify-between gap-4 border-t py-4">
          <p className="text-muted-foreground text-sm">
            © 2026 Cendaro. Todos los derechos reservados.
          </p>
          <ThemeToggle className="-mr-3" />
        </div>
      </div>

      <p
        aria-hidden="true"
        className="text-border pointer-events-none mb-[-0.22em] text-center font-serif text-[clamp(6rem,27vw,24rem)] leading-none tracking-[-0.04em] select-none"
      >
        Cendaro
      </p>
    </footer>
  );
}
