import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";

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
  },
  {
    name: "Jabón de Manos 250ml",
    price: "$2.80",
    margin: "35%",
    sku: "JAB-015",
    color: "#22c55e",
  },
  {
    name: "Suavizante Premium 1L",
    price: "$5.20",
    margin: "32%",
    sku: "SUV-008",
    color: "#8b5cf6",
  },
  {
    name: "Cloro Premium 2L",
    price: "$3.10",
    margin: "22%",
    sku: "CLR-003",
    color: "#f59e0b",
  },
  {
    name: "Esponja Multiuso x3",
    price: "$1.90",
    margin: "42%",
    sku: "ESP-022",
    color: "#06b6d4",
  },
  {
    name: "Limpiador Multiusos",
    price: "$3.75",
    margin: "30%",
    sku: "LMP-011",
    color: "#ec4899",
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
        padding: "0 36px 28px 36px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          opacity: entrance,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          C
        </div>
        <span style={{ color: "#fff", fontSize: 20, fontWeight: 600 }}>
          Cendaro
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 20 }}>·</span>
        <span
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          Catálogo
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 18,
            background: "rgba(59,130,246,0.15)",
            color: "#60a5fa",
          }}
        >
          + Agregar
        </div>
      </div>

      {/* Categories */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "14px 0",
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
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 18,
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
            fontSize: 17,
            display: "flex",
            alignItems: "center",
          }}
        >
          {PRODUCTS.length} productos
        </div>
      </div>

      {/* Product grid 3×2 */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
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
                padding: 18,
                borderRadius: 12,
                position: "relative",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: cs,
                transform: `translateY(${interpolate(cs, [0, 1], [8, 0])}px)`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Color swatch */}
              <div
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 8,
                  marginBottom: 12,
                  background: `${item.color}15`,
                  border: `1px solid ${item.color}12`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: `${item.color}35`,
                  }}
                />
              </div>

              <div
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 24,
                  fontWeight: 500,
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    fontSize: 32,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.price}
                </span>
                <span
                  style={{
                    color: "rgba(34,197,94,0.8)",
                    fontSize: 17,
                    fontWeight: 600,
                  }}
                >
                  ↑ {item.margin}
                </span>
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.2)",
                  fontSize: 14,
                  marginTop: 3,
                }}
              >
                {item.sku}
              </div>

              {/* AI tag */}
              {showTag && typeof ts === "number" && ts > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    padding: "5px 12px",
                    borderRadius: 7,
                    background: "rgba(139,92,246,0.2)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    color: "#c4b5fd",
                    fontSize: 16,
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
