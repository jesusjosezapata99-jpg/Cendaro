import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";

const FPS = 30;
const BG = "#0a0a12";

const KPIS = [
  { label: "Órdenes", value: 142, color: "#22c55e" },
  { label: "Ingresos", value: 8450, prefix: "$", color: "#3b82f6" },
  { label: "Productos", value: 267, color: "#f59e0b" },
  { label: "Clientes", value: 84, color: "#ec4899" },
];

const CLOSURES = [
  { date: "22/03", sales: "$1,240", cash: "$680", digital: "$560", orders: 18 },
  { date: "21/03", sales: "$980", cash: "$420", digital: "$560", orders: 14 },
  { date: "20/03", sales: "$1,100", cash: "$500", digital: "$600", orders: 16 },
  { date: "19/03", sales: "$870", cash: "$390", digital: "$480", orders: 12 },
];

const SPARKLINE = [42, 58, 45, 72, 65, 80, 75];
const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

const ACTIVITY = [
  {
    icon: "📦",
    text: "Pedido #1042 creado",
    time: "Hace 2 min",
    color: "#3b82f6",
  },
  {
    icon: "⚡",
    text: "Stock bajo: Jabón Antibact.",
    time: "Hace 8 min",
    color: "#f59e0b",
  },
  {
    icon: "✅",
    text: "Pedido #1038 entregado",
    time: "Hace 15 min",
    color: "#22c55e",
  },
];

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();

  const entrance = spring({
    frame,
    fps: FPS,
    config: { damping: 15, stiffness: 80 },
  });
  const fadeIn = interpolate(entrance, [0, 1], [0, 1]);
  const slideY = interpolate(entrance, [0, 1], [12, 0]);

  return (
    <AbsoluteFill
      style={{
        background: BG,
        padding: "0 36px 28px 36px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Simplified header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          opacity: fadeIn,
          transform: `translateY(${slideY}px)`,
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
          Dashboard
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            fontSize: 16,
            fontWeight: 700,
            background: "rgba(34,197,94,0.12)",
            color: "#4ade80",
          }}
        >
          BCV Bs. 91.20
        </div>
      </div>

      {/* 4 KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          paddingTop: 16,
        }}
      >
        {KPIS.map((kpi, i) => {
          const delay = i * 2;
          const s = spring({
            frame: frame - delay,
            fps: FPS,
            config: { damping: 12, stiffness: 100 },
          });
          const countValue = Math.round(interpolate(s, [0, 1], [0, kpi.value]));
          return (
            <div
              key={kpi.label}
              style={{
                padding: "16px 20px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `4px solid ${kpi.color}60`,
                transform: `translateY(${interpolate(s, [0, 1], [8, 0])}px)`,
                opacity: s,
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 20,
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                {kpi.label}
              </div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 48,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {kpi.prefix ?? ""}
                {countValue.toLocaleString("en-US")}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2 panels: Sparkline + Activity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          paddingTop: 12,
        }}
      >
        {/* Sparkline chart */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            opacity: spring({
              frame: frame - 8,
              fps: FPS,
              config: { damping: 14, stiffness: 80 },
            }),
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Ventas — Última Semana
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              height: 80,
            }}
          >
            {SPARKLINE.map((val, i) => {
              const barDelay = 10 + i * 2;
              const bs = spring({
                frame: frame - barDelay,
                fps: FPS,
                config: { damping: 14, stiffness: 80 },
              });
              const barH = interpolate(bs, [0, 1], [0, (val / 100) * 68]);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: barH,
                      borderRadius: 5,
                      background:
                        "linear-gradient(180deg, #3b82f680, #3b82f620)",
                    }}
                  />
                  <span
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  >
                    {DAYS[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity feed */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            opacity: spring({
              frame: frame - 10,
              fps: FPS,
              config: { damping: 14, stiffness: 80 },
            }),
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Actividad Reciente
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ACTIVITY.map((item, i) => {
              const aDelay = 12 + i * 3;
              const as = spring({
                frame: frame - aDelay,
                fps: FPS,
                config: { damping: 12, stiffness: 100 },
              });
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    opacity: as,
                    transform: `translateX(${interpolate(as, [0, 1], [-4, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: `${item.color}15`,
                      border: `1px solid ${item.color}25`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        fontSize: 18,
                        fontWeight: 500,
                      }}
                    >
                      {item.text}
                    </div>
                    <div
                      style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}
                    >
                      {item.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cierres de Caja table */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px",
          borderRadius: 12,
          marginTop: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          opacity: spring({
            frame: frame - 8,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          }),
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Cierres de Caja
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.8fr 1fr 1fr 1fr 0.6fr",
            gap: 10,
            padding: "0 0 8px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {["Fecha", "Ventas", "Efectivo", "Digital", "Pedidos"].map((h) => (
            <div
              key={h}
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 16,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {CLOSURES.map((row, i) => {
          const rowDelay = 10 + i * 3;
          const rs = spring({
            frame: frame - rowDelay,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          });
          return (
            <div
              key={row.date}
              style={{
                display: "grid",
                gridTemplateColumns: "0.8fr 1fr 1fr 1fr 0.6fr",
                gap: 10,
                padding: "10px 0",
                alignItems: "center",
                borderBottom:
                  i < CLOSURES.length - 1
                    ? "1px solid rgba(255,255,255,0.03)"
                    : "none",
                opacity: rs,
                transform: `translateX(${interpolate(rs, [0, 1], [-4, 0])}px)`,
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 20,
                  fontWeight: 500,
                }}
              >
                {row.date}
              </div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.sales}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 20,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.cash}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 20,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.digital}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 20,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.orders}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock alert notification */}
      {frame >= 40 &&
        (() => {
          const ns = spring({
            frame: frame - 40,
            fps: FPS,
            config: { damping: 12, stiffness: 120 },
          });
          return (
            <div
              style={{
                position: "absolute",
                bottom: 40,
                right: 48,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 20px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                opacity: ns,
                transform: `scale(${interpolate(ns, [0, 1], [0.85, 1])}) translateY(${interpolate(ns, [0, 1], [6, 0])}px)`,
              }}
            >
              <span style={{ fontSize: 18 }}>⚡</span>
              <div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 17,
                    fontWeight: 600,
                  }}
                >
                  Alerta de stock
                </div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                  Jabón Antibacterial: 8 uds
                </div>
              </div>
            </div>
          );
        })()}
    </AbsoluteFill>
  );
};
