"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  ShoppingCart,
  X,
} from "lucide-react";

import { useScrollY } from "./use-scroll-y";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

const mobileFeatures = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Package, label: "Inventario" },
  { icon: ShoppingCart, label: "Pedidos" },
  { icon: Receipt, label: "Facturación" },
];

export function Navbar() {
  const scrolled = useScrollY(50);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Lock body scroll when mobile menu is open (uses .dialog-open from globals.css) */
  useEffect(() => {
    document.documentElement.classList.toggle("dialog-open", mobileOpen);
    return () => document.documentElement.classList.remove("dialog-open");
  }, [mobileOpen]);

  return (
    <>
      <header
        className={`safe-pt fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 border-border/50 border-b backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link
            href="/"
            className="text-foreground flex items-center gap-2"
            aria-label="Cendaro — Ir al inicio"
          >
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-primary-foreground text-sm font-bold">
                C
              </span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Cendaro
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors duration-200"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.querySelector(link.href);
                  target?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="bg-foreground text-background cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </nav>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="bg-background fixed inset-0 z-40 flex flex-col px-6 pt-20 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="flex flex-col gap-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
            >
              {navLinks.map((link) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  className="text-foreground hover:bg-muted cursor-pointer rounded-lg px-4 py-3 text-lg transition-colors"
                  onClick={() => setMobileOpen(false)}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  {link.label}
                </motion.a>
              ))}

              <div className="border-border my-4 border-t" />

              {mobileFeatures.map((feature) => (
                <motion.div
                  key={feature.label}
                  className="text-muted-foreground flex items-center gap-3 rounded-lg px-4 py-3"
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  <feature.icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="text-sm">{feature.label}</span>
                </motion.div>
              ))}

              <motion.div
                className="mt-6"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Link
                  href="/login"
                  className="bg-foreground text-background block w-full cursor-pointer rounded-lg py-3 text-center text-sm font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Empezar gratis
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
