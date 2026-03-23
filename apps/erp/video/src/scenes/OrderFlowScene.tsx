import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";

const FPS = 30;
const BG = "#0a0a12";

const COLUMNS = [
  {
    label: "Nuevo",
    color: "#3b82f6",
    cards: [
      { id: "#1042", client: "Dist. Martinez", total: "$420" },
      { id: "#1043", client: "Abastos El Sol", total: "$285" },
    ],
  },
  {
    label: "Preparando",
    color: "#f59e0b",
    cards: [{ id: "#1040", client: "Super Express", total: "$680" }],
  },
  {
    label: "Enviado",
    color: "#8b5cf6",
    cards: [{ id: "#1038", client: "Farmacia Central", total: "$540" }],
  },
  {
    label: "Entregado",
    color: "#22c55e",
    cards: [
      { id: "#1035", client: "Bodega Norte", total: "$320" },
      { id: "#1036", client: "Dist. Lopez", total: "$760" },
    ],
  },
];

export const OrderFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const entrance = spring({
    frame,
    fps: FPS,
    config: { damping: 15, stiffness: 80 },
  });

  const moveStart = 60;
  const moveProgress =
    frame >= moveStart
      ? interpolate(frame - moveStart, [0, 20], [0, 1], {
          extrapolateRight: "clamp",
        })
      : 0;

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
          Pedidos
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
          + Nuevo Pedido
        </div>
      </div>

      {/* Kanban columns */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          paddingTop: 16,
        }}
      >
        {COLUMNS.map((col, colIdx) => (
          <div
            key={col.label}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "14px 14px",
              opacity: spring({
                frame: frame - 3 - colIdx * 2,
                fps: FPS,
                config: { damping: 14, stiffness: 80 },
              }),
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: col.color,
                }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 20,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {col.label}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 18,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {col.cards.length}
              </span>
            </div>

            {/* Cards */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {col.cards.map((card, cardIdx) => {
                const cardDelay = 6 + colIdx * 3 + cardIdx * 2;
                const cs = spring({
                  frame: frame - cardDelay,
                  fps: FPS,
                  config: { damping: 12, stiffness: 100 },
                });

                const isMoving =
                  colIdx === 1 && cardIdx === 0 && moveProgress > 0;

                return (
                  <div
                    key={card.id}
                    style={{
                      padding: "16px 18px",
                      borderRadius: 12,
                      background: `${col.color}10`,
                      border: `1px solid ${col.color}20`,
                      opacity: isMoving ? 1 - moveProgress : cs,
                      transform: isMoving
                        ? `translateX(${moveProgress * 30}px) scale(${1 - moveProgress * 0.1})`
                        : `translateY(${interpolate(cs, [0, 1], [6, 0])}px)`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ color: "#fff", fontSize: 24, fontWeight: 700 }}
                      >
                        {card.id}
                      </span>
                      <span
                        style={{
                          color: col.color,
                          fontSize: 22,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {card.total}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 18,
                        marginTop: 5,
                      }}
                    >
                      {card.client}
                    </div>
                  </div>
                );
              })}

              {/* Arriving card in Enviado */}
              {colIdx === 2 && moveProgress > 0.3 && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: `${col.color}10`,
                    border: `1px solid ${col.color}20`,
                    opacity: interpolate(moveProgress, [0.3, 0.7], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                    transform: `translateX(${interpolate(moveProgress, [0.3, 0.7], [-16, 0], { extrapolateRight: "clamp" })}px)`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{ color: "#fff", fontSize: 24, fontWeight: 700 }}
                    >
                      #1040
                    </span>
                    <span
                      style={{
                        color: col.color,
                        fontSize: 22,
                        fontWeight: 600,
                      }}
                    >
                      $680
                    </span>
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 18,
                      marginTop: 5,
                    }}
                  >
                    Super Express
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
