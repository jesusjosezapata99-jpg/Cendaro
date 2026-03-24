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

const METRICS = [
  { label: "Ventas Totales", value: 18450, prefix: "$", color: "#3b82f6" },
  { label: "Margen Bruto", value: 42, suffix: "%", color: "#22c55e" },
];

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const BAR_DATA = [35, 48, 42, 65, 58, 72, 68, 82, 75, 90, 85, 95];

const INVOICES = [
  {
    id: "FAC-0142",
    client: "Dist. Martinez",
    amount: "$1,240",
    status: "Pagada",
    sColor: "#22c55e",
  },
  {
    id: "FAC-0141",
    client: "Abastos El Sol",
    amount: "$980",
    status: "Pendiente",
    sColor: "#f59e0b",
  },
  {
    id: "FAC-0140",
    client: "Super Express",
    amount: "$1,100",
    status: "Pagada",
    sColor: "#22c55e",
  },
];

export const AnalyticsScene: React.FC = () => {
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
          Reportes
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            background: "rgba(59,130,246,0.15)",
            color: "#60a5fa",
          }}
        >
          Exportar
        </div>
      </div>

      {/* 2 large KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          padding: "12px 0",
        }}
      >
        {METRICS.map((m, i) => {
          const delay = i * 3;
          const ms = spring({
            frame: frame - delay,
            fps: FPS,
            config: { damping: 12, stiffness: 100 },
          });
          const countValue = Math.round(interpolate(ms, [0, 1], [0, m.value]));
          return (
            <div
              key={m.label}
              style={{
                padding: "16px 20px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${m.color}60`,
                opacity: ms,
                transform: `translateY(${interpolate(ms, [0, 1], [6, 0])}px)`,
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 15,
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 40,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {m.prefix ?? ""}
                {countValue.toLocaleString("en-US")}
                {m.suffix ?? ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div
        style={{
          padding: "12px 20px",
          borderRadius: 10,
          marginBottom: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          opacity: spring({
            frame: frame - 6,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          }),
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Ventas Mensuales — 2026
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            height: 80,
            paddingBottom: 4,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {BAR_DATA.map((val, i) => {
            const barDelay = 8 + i * 2;
            const bs = spring({
              frame: frame - barDelay,
              fps: FPS,
              config: { damping: 14, stiffness: 80 },
            });
            const barHeight = interpolate(bs, [0, 1], [0, (val / 100) * 70]);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: barHeight,
                    borderRadius: 3,
                    background: "linear-gradient(180deg, #3b82f680, #3b82f620)",
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, paddingTop: 4 }}>
          {MONTHS.map((m) => (
            <div
              key={m}
              style={{
                flex: 1,
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* Invoice table */}
      <div
        style={{
          flex: 1,
          padding: "12px 20px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
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
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Últimas Facturas
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr",
            gap: 8,
            padding: "0 0 6px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 700,
            color: "rgba(255,255,255,0.25)",
            fontSize: 12,
          }}
        >
          <span>Factura</span>
          <span style={{ textAlign: "right" }}>Monto</span>
          <span style={{ textAlign: "right" }}>Estado</span>
        </div>

        {INVOICES.map((inv, i) => {
          const rowDelay = 10 + i * 3;
          const rs = spring({
            frame: frame - rowDelay,
            fps: FPS,
            config: { damping: 14, stiffness: 80 },
          });
          return (
            <div
              key={inv.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                gap: 8,
                alignItems: "center",
                padding: "8px 0",
                borderBottom:
                  i < INVOICES.length - 1
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
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {inv.id}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 13,
                    marginTop: 1,
                  }}
                >
                  {inv.client}
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {inv.amount}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 600,
                    background: `${inv.sColor}15`,
                    color: inv.sColor,
                  }}
                >
                  {inv.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
