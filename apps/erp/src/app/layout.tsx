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
import { isIndexableDeployment } from "~/lib/site";
import { siteUrl } from "~/lib/site-env";

import "./globals.css";

/**
 * Hedvig Letters Sans + Serif — the Cendaro UI identity (see
 * PLAN-2026-09-DESIGN-SYSTEM §5.4). Weight 400 only (the family's only
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
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  preload: false,
});

const isIndexable = isIndexableDeployment(env.VERCEL_ENV);

export const metadata: Metadata = {
  // Canonical origin for OG/Twitter images and canonical links: the public
  // site URL (NEXT_PUBLIC_SITE_URL, else the production Vercel URL), never a
  // per-deployment preview URL (PLAN-2026-09-LANDING-REDESIGN T1.3).
  metadataBase: siteUrl,
  title: "Cendaro",
  applicationName: "Cendaro",
  category: "business",
  creator: "Cendaro",
  publisher: "Cendaro",
  description:
    "Sistema ERP Omnicanal para gestión de inventarios, ventas, precios y operaciones",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: isIndexable
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      }
    : {
        index: false,
        follow: false,
      },
  ...(env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
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
        {/* AI, LLM & Google WebSub Discovery (llmstxt.org v2 + RSS 2.0) */}
        <link
          rel="alternate"
          type="application/rss+xml"
          href="/feed.xml"
          title="Cendaro — Módulos y Funciones del Sistema ERP (RSS)"
        />
        <link
          rel="alternate"
          type="text/markdown"
          href="/llms.txt"
          title="Cendaro — Resumen estructurado para IA (llms.txt)"
        />
        <link
          rel="alternate"
          type="text/markdown"
          href="/llms-full.txt"
          title="Cendaro — Documentación completa para IA (llms-full.txt)"
        />
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
