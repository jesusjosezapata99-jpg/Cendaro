import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "~/components/theme-provider";
import { env } from "~/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500", "600"],
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
        {/* dns-prefetch + preconnect for Google Fonts CDN */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Material Symbols — preloaded to eliminate FOUI */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        {/* One-time migration: clear stale "light" default so next-themes re-detects system preference.
             Safe to remove after all existing users have revisited (e.g. 2026-Q2). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var k="cendaro-theme",v=localStorage.getItem(k);if(v==='"light"'||v==="light")localStorage.removeItem(k)}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} bg-background text-foreground font-sans antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
