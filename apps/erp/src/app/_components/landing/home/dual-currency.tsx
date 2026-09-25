import { MAX_AUTOMATIC_RATE_DEVIATION } from "@cendaro/validators";

import { FACTS } from "../content";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";
import { DualCurrencyDemo } from "./dual-currency-demo";

/** Example products and rate for the explainer (sample data, labelled as such). */
const DEMO_PRODUCTS = [
  { name: "Detergente líquido 2 L", usd: 3.9 },
  { name: "Bombillo LED 12 W", usd: 2.1 },
  { name: "Taladro percutor 650 W", usd: 45 },
] as const;
const EXAMPLE_RATE = 853.4993;

/** "Hecho para Venezuela": dollars and bolívars, natively (plan §6.1 #6). */
export function DualCurrency() {
  return (
    <section
      id="doble-moneda"
      aria-labelledby="doble-moneda-title"
      className="border-border scroll-mt-20 border-t py-16 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="doble-moneda-title"
          eyebrow={{ index: "02", label: "Doble moneda" }}
          title="Precios en dólares, cobros en bolívares, cuentas claras"
          description={`La tasa BCV se sincroniza sola cada día. Si se dispara más de ${FACTS.rateHoldPct} de golpe, no se aplica hasta que alguien la apruebe.`}
        />
        <Reveal variant="rise" className="mt-10 md:mt-16">
          <DualCurrencyDemo
            products={DEMO_PRODUCTS}
            rate={EXAMPLE_RATE}
            holdRatio={MAX_AUTOMATIC_RATE_DEVIATION}
            holdLabel={FACTS.rateHoldPct}
          />
        </Reveal>
      </div>
    </section>
  );
}
