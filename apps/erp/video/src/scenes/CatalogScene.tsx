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

const CATEGORIES = ["Todos", "Limpieza", "Higiene", "Hogar"];

const PRODUCTS = [
  {
    name: "Detergente Líquido 1L",
    price: "$4.50",
    margin: "28%",
    sku: "DET-001",
    color: "#3b82f6",
    image: "products/detergente.png",
  },
  {
    name: "Jabón de Manos 250ml",
    price: "$2.80",
    margin: "35%",
    sku: "JAB-015",
    color: "#22c55e",
    image: "products/jabon.png",
  },
  {
    name: "Suavizante Premium 1L",
    price: "$5.20",
    margin: "32%",
    sku: "SUV-008",
    color: "#8b5cf6",
    image: "products/suavizante.png",
  },
  {
    name: "Cloro Premium 2L",
    price: "$3.10",
    margin: "22%",
    sku: "CLR-003",
    color: "#f59e0b",
    image: "products/cloro.png",
  },
  {
    name: "Esponja Multiuso x3",
    price: "$1.90",
    margin: "42%",
    sku: "ESP-022",
    color: "#06b6d4",
    image: "products/esponja.png",
  },
  {
    name: "Limpiador Multiusos",
    price: "$3.75",
    margin: "30%",
    sku: "LMP-011",
    color: "#ec4899",
    image: "products/limpiador.png",
  },
];

const AI_TAGS = ["✨ Limpieza", "✨ Higiene", "✨ Hogar"];

export const CatalogScene: React.FC = () => {
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
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 36px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          opacity: entrance,
          flexShrink: 0,
        }}
      >
        <Img
          src={staticFile("cendaro-logo.png")}
          style={{
            width: 28,
            height: 28,
            borderRadius: 5,
            objectFit: "contain",
          }}
        />
        <span style={{ color: "#fff", fontSize: 17, fontWeight: 600 }}>
          Cendaro
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 17 }}>·</span>
        <span
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 17,
            fontWeight: 500,
          }}
        >
          Catálogo
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            background: "rgba(59,130,246,0.15)",
            color: "#60a5fa",
          }}
        >
          + Agregar
        </div>
      </div>

      {/* Categories bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 36px",
          flexShrink: 0,
          opacity: spring({
            frame: frame - 3,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          }),
        }}
      >
        {CATEGORIES.map((cat, i) => (
          <div
            key={cat}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background:
                i === 0 ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
              color: i === 0 ? "#60a5fa" : "rgba(255,255,255,0.4)",
              border:
                i === 0
                  ? "1px solid rgba(59,130,246,0.25)"
                  : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {cat}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
          }}
        >
          {PRODUCTS.length} productos
        </div>
      </div>

      {/* Product grid 3×2 — fills remaining space */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "1fr 1fr",
          gap: 12,
          padding: "0 36px 20px 36px",
          minHeight: 0,
        }}
      >
        {PRODUCTS.map((item, i) => {
          const cardDelay = 5 + i * 2;
          const cs = spring({
            frame: frame - cardDelay,
            fps: FPS,
            config: { damping: 12, stiffness: 100 },
          });

          const tagIdx = [0, 2, 4].indexOf(i);
          const showTag = tagIdx >= 0;
          const tagDelay = 40 + tagIdx * 8;
          const ts =
            showTag && frame >= tagDelay
              ? spring({
                  frame: frame - tagDelay,
                  fps: FPS,
                  config: { damping: 10, stiffness: 140 },
                })
              : 0;

          return (
            <div
              key={item.sku}
              style={{
                borderRadius: 12,
                position: "relative",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: cs,
                transform: `translateY(${interpolate(cs, [0, 1], [8, 0])}px)`,
                display: "flex",
                flexDirection: "column",
                padding: 16,
                overflow: "hidden",
              }}
            >
              {/* Product image — takes 50% of card height */}
              <div
                style={{
                  flex: 1,
                  borderRadius: 10,
                  marginBottom: 12,
                  background: `linear-gradient(135deg, ${item.color}08, ${item.color}15)`,
                  border: `1px solid ${item.color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  minHeight: 0,
                }}
              >
                <Img
                  src={staticFile(item.image)}
                  style={{
                    width: "60%",
                    height: "80%",
                    objectFit: "contain",
                  }}
                />
              </div>

              {/* Product info — fixed at bottom */}
              <div style={{ flexShrink: 0 }}>
                <div
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    marginBottom: 6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 22,
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.price}
                  </span>
                  <span
                    style={{
                      color: "rgba(34,197,94,0.8)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ↑ {item.margin}
                  </span>
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 11,
                    marginTop: 3,
                  }}
                >
                  {item.sku}
                </div>
              </div>

              {/* AI tag */}
              {showTag && typeof ts === "number" && ts > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "rgba(139,92,246,0.2)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    color: "#c4b5fd",
                    fontSize: 12,
                    fontWeight: 700,
                    opacity: ts,
                    transform: `scale(${interpolate(ts, [0, 1], [0.6, 1])})`,
                  }}
                >
                  {AI_TAGS[tagIdx] ?? "✨ IA"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
