"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import { createPortal } from "react-dom";

import { cn } from "@cendaro/ui";
import { buttonVariants } from "@cendaro/ui/button";
import { Icons } from "@cendaro/ui/icons";

import { NAV_LINKS } from "./nav-links";

interface MobileMenuProps {
  /** "Solicitar acceso" link (WhatsApp or mailto), or null when unset. */
  requestHref: string | null;
  requestIsWhatsApp: boolean;
}

/**
 * Phone navigation (plan T4.1): full-screen panel with real links, focus
 * trapped inside, Esc closes and returns focus, page scroll locked
 * (`dialog-open`, globals.css), targets ≥ 44px.
 */
export function MobileMenu({
  requestHref,
  requestIsWhatsApp,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dialog-open", open);
    if (!open) return;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("a, button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("dialog-open");
    };
  }, [open]);

  const close = (): void => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="menu-movil"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className="focus-visible:ring-ring flex size-11 items-center justify-center outline-none focus-visible:ring-1 md:hidden"
      >
        <Icons.Menu className="size-5" />
      </button>

      {/* Portal: the scrolled header's backdrop-filter would otherwise become
          the containing block of this fixed panel and clip it to 64px. */}
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <m.div
                  ref={panelRef}
                  id="menu-movil"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menú"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.25 }}
                  className="safe-pt bg-background fixed inset-0 z-60 flex flex-col px-4 pb-8 md:hidden"
                >
                  <div className="flex h-16 items-center justify-between">
                    <span className="text-lg font-medium tracking-tight">
                      Cendaro
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        buttonRef.current?.focus();
                      }}
                      aria-label="Cerrar menú"
                      className="focus-visible:ring-ring -mr-3 flex size-11 items-center justify-center outline-none focus-visible:ring-1"
                    >
                      <Icons.Close className="size-5" />
                    </button>
                  </div>
                  <nav aria-label="Principal" className="mt-4 flex flex-col">
                    {NAV_LINKS.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={close}
                        className="border-border flex min-h-14 items-center justify-between border-b font-serif text-2xl"
                      >
                        {link.label}
                        <Icons.ArrowForward className="text-muted-foreground size-5" />
                      </a>
                    ))}
                  </nav>
                  <div className="mt-auto flex flex-col gap-3">
                    {requestHref ? (
                      <a
                        href={requestHref}
                        onClick={close}
                        {...(requestIsWhatsApp
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className={cn(
                          buttonVariants({ size: "lg" }),
                          "h-12 w-full",
                        )}
                      >
                        Solicitar acceso
                      </a>
                    ) : null}
                    <Link
                      href="/login"
                      onClick={close}
                      className={cn(
                        buttonVariants({
                          variant: requestHref ? "outline" : "default",
                          size: "lg",
                        }),
                        "h-12 w-full",
                      )}
                    >
                      Iniciar sesión
                    </Link>
                  </div>
                </m.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
