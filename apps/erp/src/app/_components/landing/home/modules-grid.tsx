import Link from "next/link";

import { Icon, Icons } from "@cendaro/ui/icons";
import { ERP_MODULES } from "@cendaro/validators";

import { FACTS, MODULE_GROUPS, MODULES } from "../content";
import { featureHref, MODULE_FEATURE } from "../features";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

const CELL = "flex h-full flex-col gap-2 p-3 sm:flex-row sm:gap-4 sm:p-5";
const CELL_LINK = `${CELL} hover:bg-muted transition-colors duration-(--motion-micro)`;

/** The 18 modules, grouped, with hairline cells (plan §6.1 #7). */
export function ModulesGrid() {
  return (
    <section
      id="funciones"
      aria-labelledby="funciones-title"
      className="border-border scroll-mt-20 border-t py-16 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="funciones-title"
          eyebrow={{ index: "03", label: "Funciones" }}
          title={`${FACTS.modules} módulos que hablan entre sí`}
          description="Activa los que tu operación necesita. Todos comparten los mismos productos, clientes, tasas y permisos."
        />
        <div className="mt-10 flex flex-col gap-6 sm:gap-8 md:mt-16 md:gap-10">
          {MODULE_GROUPS.map((group) => {
            const modules = ERP_MODULES.filter(
              (m) => MODULES[m].group === group,
            );
            return (
              <Reveal key={group} variant="fade">
                <h3 className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                  {group}
                </h3>
                <ul className="border-border mt-4 grid grid-cols-2 border-t border-l lg:grid-cols-4">
                  {modules.map((m) => {
                    const info = MODULES[m];
                    const slug = MODULE_FEATURE[m];
                    const cell = (
                      <>
                        <span className="border-border flex size-10 shrink-0 items-center justify-center border">
                          <Icon name={info.icon} className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium sm:text-base">
                            {info.name}
                          </span>
                          <span className="text-muted-foreground mt-1 hidden text-sm leading-snug sm:block">
                            {info.line}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={m} className="border-border border-r border-b">
                        {slug ? (
                          <Link href={featureHref(slug)} className={CELL_LINK}>
                            {cell}
                          </Link>
                        ) : (
                          <div className={CELL}>{cell}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Reveal>
            );
          })}
        </div>
        <Link
          href="/funciones"
          className="group mt-10 inline-flex min-h-11 items-center gap-2 text-sm"
        >
          Ver todas las funciones
          <Icons.ArrowForward className="size-4 transition-transform duration-(--motion-micro) group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
