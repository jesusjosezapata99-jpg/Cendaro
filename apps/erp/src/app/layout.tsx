import type { Metadata, Viewport } from "next";
import {
  Geist_Mono,
  Hedvig_Letters_Sans,
  Hedvig_Letters_Serif,
} from "next/font/google";

import { AppToaster } from "~/components/app-toaster";
import { MotionProvider } from "~/components/motion-provider";
import { ThemeProvider } from "~/components/theme-provider";
import { env } from "~/env";

import "./globals.css";

/**
 * Hedvig Letters Sans + Serif — the Midday-derived UI identity (see
 * PLAN-2026-09-MIDDAY-REDESIGN §5.4). Weight 400 only (the family's only
 * cut) — `font-medium/bold` must never be used, Chrome would synthesize a
 * fake bold. Geist Mono is kept for numeric columns: Hedvig's digits are
 * proportional and have no `tnum` (verified with fontTools), so tabular
 * figures still need a monospace fallback (DEV-5).
 */
const hedvigSans = Hedvig_Letters_Sans({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
  variable: "--font-hedvig-sans",
  fallback: ["system-ui", "arial"],
});

const hedvigSerif = Hedvig_Letters_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
  variable: "--font-hedvig-serif",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  // Canonical URL for OG/Twitter images. VERCEL_URL is injected by Vercel at build time.
  metadataBase: new URL(
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000",
  ),
  title: "Cendaro",
  description:
    "Sistema ERP Omnicanal para gestión de inventarios, ventas, precios y operaciones",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* iOS Standalone Web App */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Cendaro" />
        <link rel="apple-touch-icon" href="/cendaro-logo.png" />
      </head>
      <body
        className={`${hedvigSans.variable} ${hedvigSerif.variable} ${geistMono.variable} bg-background text-foreground font-sans antialiased`}
      >
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
        <AppToaster />
      </body>
    </html>
  );
}
