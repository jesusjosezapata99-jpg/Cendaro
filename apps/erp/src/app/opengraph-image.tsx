import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Cendaro — ERP Omnicanal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  // Embed the logo from /public instead of fetching it over the network:
  // the previous `https://cendaro.com/cendaro-logo.png` fetch failed at build
  // time ("Can't load image … fetch failed"), so every shared link preview
  // shipped without the logo. Reading the local file is deterministic.
  const logo = await readFile(join(process.cwd(), "public/cendaro-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, rgb(10, 10, 10) 0%, rgb(17, 24, 39) 50%, rgb(10, 10, 10) 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Glow effect */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "400px",
          background:
            "radial-gradient(ellipse, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* Logo */}
      <img
        src={logoSrc}
        alt="Cendaro"
        width={64}
        height={64}
        style={{ marginBottom: "24px" }}
      />

      {/* Headline */}
      <h1
        style={{
          fontSize: "56px",
          fontWeight: 700,
          color: "rgb(249, 250, 251)",
          textAlign: "center",
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          maxWidth: "900px",
          margin: "0 0 16px 0",
        }}
      >
        Gestión inteligente para negocios que crecen
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "24px",
          color: "rgb(156, 163, 175)",
          textAlign: "center",
          maxWidth: "650px",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        ERP Omnicanal: inventario, pedidos, catálogo y facturación en un solo
        lugar.
      </p>

      {/* Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "32px",
          padding: "8px 20px",
          borderRadius: "999px",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
        }}
      >
        <span style={{ fontSize: "16px", color: "rgb(96, 165, 250)" }}>
          cendaro.com — Empieza gratis
        </span>
      </div>
    </div>,
    { ...size },
  );
}
