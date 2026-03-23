import { ScrollEntrance } from "./scroll-entrance";

/* Inline SVG logos for real brand recognition — no placeholder text */
const integrations = [
  {
    name: "Stripe",
    svg: (
      <svg viewBox="0 0 60 25" fill="currentColor" className="h-5 w-auto">
        <path d="M7.5 7.3c0-.9.7-1.3 1.9-1.3 1.7 0 3.8.5 5.5 1.4V2.8C13.2 2.2 11.5 1.8 9.7 1.8c-4 0-6.6 2.1-6.6 5.5 0 5.4 7.4 4.5 7.4 6.9 0 1.1-.9 1.4-2.2 1.4-1.9 0-4.4-.8-6.3-1.9v4.8c2.2 .9 4.3 1.3 6.3 1.3 4.1 0 6.9-2 6.9-5.5C15.2 8.7 7.5 9.8 7.5 7.3zM22.2 4.4l-.1-2.6h-4.3v18h4.9V8.7c1.2-1.5 3.1-1.2 3.7-1V2.8c-.7-.3-3-.6-4.2 1.6zM28.6 1.8h4.9v18h-4.9zM28.6.2h4.9V3.8h-4.9zM40.5 1.8l-3.1.7V6h-2.1v3.6h2.1v7.2c0 3 1.4 4.2 4.3 4.2 1.3 0 2.3-.3 2.9-.5v-3.5c-.4.2-1.5.4-2.1.4-.9 0-1.5-.3-1.5-1.5V9.6h2.6V6h-2.6V1.8zM52.7 6.1c-1.6 0-2.6.7-3.2 1.3l-.2-1.4h-4.3v18l4.9-1V19c.6.5 1.5 1 3 1 3 0 5.8-2.5 5.8-7.9C58.7 8 55.8 6.1 52.7 6.1zm-1 10.7c-1 0-1.6-.4-2-.8V10c.4-.5 1.1-.9 2-.9 1.5 0 2.6 1.7 2.6 3.8s-1 3.9-2.6 3.9zM60 13z" />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    name: "Excel",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M23 1.5q.41 0 .7.3.3.29.3.7v19q0 .41-.3.7-.29.3-.7.3H7q-.41 0-.7-.3-.3-.29-.3-.7V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h5V2.5q0-.41.3-.7.29-.3.7-.3zM6 13.28l1.42 2.66h2.14l-2.38-3.87 2.34-3.8H7.46l-1.3 2.4-.05.08-.04.09-.64-1.28-.66-1.29H2.59l2.27 3.82-2.48 3.85h2.16zM14.25 21v-3H7.5v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3H7.5v3zm8.25 15v-3h-6.75v3zm0-4.5v-3.75h-6.75v3.75zm0-5.25V7.5h-6.75v3.75zm0-5.25V3h-6.75v3z" />
      </svg>
    ),
  },
  {
    name: "QuickBooks",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm-1.19 18.38H8.38c-2.09 0-3.79-1.7-3.79-3.79v-5.2c0-2.09 1.7-3.79 3.79-3.79h.59v2.5h-.59c-.71 0-1.29.58-1.29 1.29v5.2c0 .71.58 1.29 1.29 1.29h2.43c.71 0 1.29-.58 1.29-1.29V7.5h2.5v7.09c0 2.09-1.7 3.79-3.79 3.79zm8.6-5.19c0 2.09-1.7 3.79-3.79 3.79h-.59v-2.5h.59c.71 0 1.29-.58 1.29-1.29v-5.2c0-.71-.58-1.29-1.29-1.29h-2.43c-.71 0-1.29.58-1.29 1.29V16.5h-2.5V9.41c0-2.09 1.7-3.79 3.79-3.79h2.43c2.09 0 3.79 1.7 3.79 3.79v3.98z" />
      </svg>
    ),
  },
  {
    name: "Supabase",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path
          d="M13.32 22.956c-.498.66-1.546.24-1.56-.623l-.202-12.33h8.64c1.56 0 2.42 1.8 1.44 3l-8.32 9.95z"
          opacity="0.6"
        />
        <path d="M10.68 1.044c.498-.66 1.546-.24 1.56.623l.202 12.33H3.8c-1.56 0-2.42-1.8-1.44-3l8.32-9.95z" />
      </svg>
    ),
  },
  {
    name: "Google Sheets",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path
          d="M19.5 7.134V21a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 21V3A1.5 1.5 0 016 1.5h9.366L19.5 7.134z"
          opacity="0.3"
        />
        <path
          d="M19.5 7.5h-4.5a1.5 1.5 0 01-1.5-1.5V1.5L19.5 7.5z"
          opacity="0.6"
        />
        <rect x="7" y="10" width="10" height="1.5" rx="0.25" opacity="0.8" />
        <rect x="7" y="13" width="10" height="1.5" rx="0.25" opacity="0.6" />
        <rect x="7" y="16" width="7" height="1.5" rx="0.25" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Shopify",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.733c-.022-.12-.139-.194-.236-.194s-1.963-.14-1.963-.14-.994-.976-1.405-1.38c-.12.037-.247.073-.385.112v.001c-.146.046-.308.095-.485.147-.284-.827-.786-1.588-1.672-1.588-.025 0-.05.001-.075.002C13.244.987 12.64.5 12.163.5c-3.467 0-5.143 4.334-5.66 6.534-.673.209-1.152.357-1.21.376-.656.206-.676.226-.762.848-.064.463-1.785 13.72-1.785 13.72l11.985 2.07.606-.069zM12.167 2.766v.106c-.582.18-1.213.375-1.86.576.36-1.387 1.036-2.06 1.626-2.312.096.215.193.476.234 1.63zm-1.08-2.13c.107 0 .213.03.317.098-.767.362-1.593 1.274-1.942 3.097-.515.16-1.02.316-1.493.463C8.53 2.604 9.775.636 11.087.636zM11.39 11.53c.061 1.064-2.795 1.276-2.95 5.282-.12 3.15 1.668 5.327 4.423 5.492l.003-.01c.278-.164.54-.37.782-.62-.01.01-.019.02-.029.03l.015-.016c2.32-2.524 1.42-6.182 1.098-6.552-.326-.374-.782-.73-1.202-.952C14.58 13.49 11.34 10.765 11.39 11.53z" />
      </svg>
    ),
  },
  {
    name: "WooCommerce",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M2.227 4.857A3.612 3.612 0 000 8.197v7.572c0 1.46.87 2.726 2.137 3.29l7.794 3.36a4.256 4.256 0 003.338.143l8.374-3.088A3.612 3.612 0 0024 16.113V8.197a3.612 3.612 0 00-2.227-3.34L13.957 1.3a4.256 4.256 0 00-3.574.019L2.227 4.857zM7.2 8.4c.9 0 1.5.6 1.5 1.5v4.2c0 .9-.6 1.5-1.5 1.5s-1.5-.6-1.5-1.5V9.9c0-.9.6-1.5 1.5-1.5zm4.8 0c.9 0 1.5.6 1.5 1.5v4.2c0 .9-.6 1.5-1.5 1.5s-1.5-.6-1.5-1.5V9.9c0-.9.6-1.5 1.5-1.5zm4.35 1.2c.15-.6.75-1.05 1.35-.9.6.15 1.05.75.9 1.35l-1.2 4.2c-.15.6-.75 1.05-1.35.9-.6-.15-1.05-.75-.9-1.35l1.2-4.2z" />
      </svg>
    ),
  },
];

function LogoIcon({ integration }: { integration: (typeof integrations)[0] }) {
  return (
    <div className="border-border bg-card text-muted-foreground/40 hover:text-foreground hover:border-muted-foreground/30 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 hover:scale-110">
      {integration.svg}
    </div>
  );
}

function MarqueeRow({
  items,
  reverse = false,
}: {
  items: typeof integrations;
  reverse?: boolean;
}) {
  const doubled = [...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        className="flex gap-12"
        style={{
          animation: `${reverse ? "marquee-reverse" : "marquee"} 50s linear infinite`,
          width: "max-content",
        }}
      >
        {doubled.map((integration, i) => (
          <div
            key={`${integration.name}-${i}`}
            className="flex flex-col items-center gap-2"
          >
            <LogoIcon integration={integration} />
            <span className="text-muted-foreground/40 text-[10px] font-medium">
              {integration.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntegrationsMarquee() {
  const row1 = integrations.slice(0, 4);
  const row2 = integrations.slice(4);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Funciona con tus herramientas
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
            Conecta con las plataformas que ya usas. Sin configuración
            complicada.
          </p>
        </ScrollEntrance>

        <div className="mt-16 space-y-8">
          <MarqueeRow items={row1} />
          <MarqueeRow items={row2} reverse />
        </div>

        <ScrollEntrance delay={0.2}>
          <div className="mt-12 text-center">
            <a
              href="#"
              className="text-primary hover:text-primary/80 cursor-pointer text-sm font-medium transition-colors"
            >
              Ver todas las integraciones →
            </a>
          </div>
        </ScrollEntrance>
      </div>
    </section>
  );
}
