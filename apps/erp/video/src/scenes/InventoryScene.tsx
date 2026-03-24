import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

const FPS = 30;
const BG = "#0a0a12";

const PRODUCTS = [
  {
    name: "Detergente Líquido 1L",
    sku: "DET-001",
    stock: 142,
    status: "ok" as const,
    price: "$4.50",
  },
  {
    name: "Jabón Antibacterial",
    sku: "JAB-015",
    stock: 8,
    status: "low" as const,
    price: "$2.80",
  },
  {
    name: "Suavizante Premium",
    sku: "SUV-008",
    stock: 67,
    status: "ok" as const,
    price: "$5.20",
  },
  {
    name: "Cloro Concentrado 2L",
    sku: "CLR-003",
    stock: 3,
    status: "critical" as const,
    price: "$3.10",
  },
  {
    name: "Esponja Multiuso x3",
    sku: "ESP-022",
    stock: 89,
    status: "ok" as const,
    price: "$1.90",
  },
];

const STATUS_MAP = {
  ok: {
    label: "En stock",
    bg: "rgba(34,197,94,0.12)",
    color: "#4ade80",
    dot: "#22c55e",
  },
  low: {
    label: "Bajo",
    bg: "rgba(245,158,11,0.12)",
    color: "#fbbf24",
    dot: "#f59e0b",
  },
  critical: {
    label: "Crítico",
    bg: "rgba(239,68,68,0.12)",
    color: "#f87171",
    dot: "#ef4444",
  },
};

export const InventoryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const entrance = spring({
    frame,
    fps: FPS,
    config: { damping: 15, stiffness: 80 },
  });

  return (
    <AbsoluteFill
      style={{
        background: BG,
        padding: "0 32px 20px 32px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          opacity: entrance,
        }}
      >
        <Img
          src={staticFile("cendaro-logo.png")}
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            objectFit: "contain",
          }}
        />
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>
          Cendaro
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>·</span>
        <span
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          Inventario
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 15,
          }}
        >
          🔍 Buscar producto...
        </div>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "12px 0",
          opacity: spring({
            frame: frame - 3,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          }),
        }}
      >
        {[
          { label: "Total", value: "267", color: "#3b82f6" },
          { label: "Stock Bajo", value: "12", color: "#f59e0b" },
          { label: "Sin Stock", value: "3", color: "#ef4444" },
        ].map((s, i) => {
          const ss = spring({
            frame: frame - 3 - i * 2,
            fps: FPS,
            config: { damping: 12, stiffness: 100 },
          });
          return (
            <div
              key={s.label}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${s.color}60`,
                opacity: ss,
                transform: `translateY(${interpolate(ss, [0, 1], [6, 0])}px)`,
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 2,
                }}
              >
                {s.label}
              </div>
              <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div
        style={{
          flex: 1,
          borderRadius: 10,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "0 16px",
          overflow: "hidden",
          opacity: spring({
            frame: frame - 5,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          }),
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.5fr 1fr 1fr 1.2fr",
            gap: 12,
            padding: "10px 0 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 700,
            color: "rgba(255,255,255,0.25)",
            fontSize: 13,
          }}
        >
          <span>Producto</span>
          <span style={{ textAlign: "right" }}>Precio</span>
          <span style={{ textAlign: "right" }}>Stock</span>
          <span style={{ textAlign: "right" }}>Estado</span>
        </div>

        {PRODUCTS.map((item, i) => {
          const rowDelay = 6 + i * 3;
          const rs = spring({
            frame: frame - rowDelay,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          });
          const style = STATUS_MAP[item.status];

          return (
            <div
              key={item.sku}
              style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 1fr 1fr 1.2fr",
                gap: 12,
                alignItems: "center",
                padding: "10px 0",
                borderBottom:
                  i < PRODUCTS.length - 1
                    ? "1px solid rgba(255,255,255,0.03)"
                    : "none",
                opacity: rs,
                transform: `translateX(${interpolate(rs, [0, 1], [-4, 0])}px)`,
              }}
            >
              <div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 20,
                    fontWeight: 500,
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.25)",
                    fontSize: 13,
                    marginTop: 1,
                  }}
                >
                  {item.sku}
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {item.price}
              </div>
              <div
                style={{
                  textAlign: "right",
                  color: "#fff",
                  fontSize: 24,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {item.stock}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: style.bg,
                    color: style.color,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: style.dot,
                    }}
                  />
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
