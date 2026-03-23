import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cendaro — ERP Omnicanal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          "linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)",
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
        src={new URL("/cendaro-logo.png", "https://cendaro.com").toString()}
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
          color: "#f9fafb",
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
          color: "#9ca3af",
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
