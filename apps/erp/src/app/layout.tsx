import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import { MotionProvider } from "~/components/motion-provider";
import { ThemeProvider } from "~/components/theme-provider";
import { env } from "~/env";

import "./globals.css";

/**
 * Geist Sans + Geist Mono — the technical UI identity (Linear/Vercel-grade).
 * Self-hosted at build time via next/font (zero CDN requests). Geist Mono
 * pairs 1:1 with Sans and ships tabular figures for aligned numerics.
 */
const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500", "600"],
});

/**
 * Material Symbols — self-hosted subset (~14 KB).
 *
 * Generated with the official Google Fonts subsetter:
 *   https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined
 *     :opsz,wght,FILL,GRAD@24,400,0,0&icon_names=<136 sorted ligatures>
 *
 * Icon list: ./fonts/material-symbols-subset.txt (validated against the
 * official Material Symbols codepoints file). If a new ligature is used in
 * code, regenerate the subset — missing names render as literal text.
 *
 * Axes are pinned to Google's defaults (opsz 24, wght 400, FILL 0, GRAD 0)
 * because the app never varies them — this shrinks the font from the full
 * variable file (295 KB over CDN) to ~14 KB, served same-origin with preload
 * (no render-blocking third-party request, critical on Venezuelan 3G).
 * `display: block` keeps ligature text invisible during the brief swap window.
 */
const materialSymbols = localFont({
  src: "./fonts/material-symbols-subset.woff2",
  weight: "400",
  style: "normal",
  display: "block",
  variable: "--font-material-symbols",
  adjustFontFallback: false,
  fallback: ["sans-serif"],
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
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
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
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${materialSymbols.variable} bg-background text-foreground font-sans antialiased`}
      >
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
