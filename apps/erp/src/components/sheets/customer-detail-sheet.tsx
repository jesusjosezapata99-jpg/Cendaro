"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { SheetBody, SheetFooter, SheetModal } from "~/components/sheet-modal";
import { Skeleton } from "~/components/skeleton";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface CustomerDetailSheetProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
}

const TYPE_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  wholesale: { label: "Mayorista", tone: "default" },
  retail: { label: "Detal", tone: "neutral" },
  distributor: { label: "Distribuidor", tone: "warning" },
  vip: { label: "VIP", tone: "success" },
  marketplace: { label: "Marketplace", tone: "default" },
  vendor_client: { label: "Cliente Vendedor", tone: "success" },
};

export function CustomerDetailSheet({
  open,
  onClose,
  customerId,
}: CustomerDetailSheetProps) {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const { data: customer, isLoading } = useQuery(
    trpc.sales.customerById.queryOptions(
      { id: customerId },
      { enabled: open && Boolean(customerId) },
    ),
  );

  const typeCfg = useMemo((): { label: string; tone: StatusTone } => {
    if (!customer) return { label: "Cliente", tone: "neutral" };
    return (
      TYPE_CONFIG[customer.customerType] ?? {
        label: customer.customerType,
        tone: "neutral",
      }
    );
  }, [customer]);

  const dualCredit = useMemo(() => {
    if (!customer) return { usd: "—", bs: "—" };
    return formatDualCurrency(Number(customer.creditLimit ?? 0), bcv.rate);
  }, [customer, bcv.rate]);

  const initials = customer
    ? customer.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={customer ? customer.name : "Detalle de Cliente"}
      description="Perfil y resumen comercial del cliente"
      maxWidth="sm:max-w-xl md:max-w-2xl"
    >
      {isLoading ? (
        <SheetBody>
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="border-border h-28 w-full border" />
            <Skeleton className="border-border h-36 w-full border" />
          </div>
        </SheetBody>
      ) : !customer ? (
        <SheetBody>
          <div className="py-12 text-center">
            <Icons.PersonOff className="text-muted-foreground mx-auto mb-2 block size-9" />
            <p className="text-foreground font-medium">Cliente no encontrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              El cliente solicitado no existe o fue eliminado.
            </p>
          </div>
        </SheetBody>
      ) : (
        <div className="flex h-full flex-col">
          <SheetBody>
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="border-border bg-card flex items-start gap-4 border p-4">
                <div className="bg-primary/10 text-primary border-border flex size-12 shrink-0 items-center justify-center border text-base font-black">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-foreground truncate text-base font-medium">
                      {customer.name}
                    </h3>
                    <StatusPill tone={typeCfg.tone}>{typeCfg.label}</StatusPill>
                  </div>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {customer.identification
                      ? `RIF: ${customer.identification}`
                      : "Sin RIF registrado"}
                  </p>
                  {customer.legalName && (
                    <p className="text-muted-foreground text-xs">
                      {customer.legalName}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="border-border bg-card divide-border/60 divide-y border text-xs">
                {customer.phone && (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">Teléfono</span>
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-foreground hover:text-primary font-mono font-medium transition-colors"
                    >
                      {customer.phone}
                    </a>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">
                      Correo Electrónico
                    </span>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-foreground hover:text-primary font-medium transition-colors"
                    >
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.address && (
                  <div className="p-3">
                    <span className="text-muted-foreground mb-1 block">
                      Dirección Fiscal / Entrega
                    </span>
                    <p className="text-foreground">{customer.address}</p>
                  </div>
                )}
              </div>

              {/* Commercial & Credit info */}
              <div className="border-border bg-card space-y-2 border p-4 text-xs">
                <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                  Límite de Crédito Otorgado
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-foreground font-medium">
                    Monto Máximo
                  </span>
                  <div className="text-right">
                    <span className="text-primary font-mono text-base font-medium tabular-nums">
                      {dualCredit.usd}
                    </span>
                    {bcv.rate > 0 && (
                      <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                        {dualCredit.bs}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-11 text-xs"
              >
                Cerrar
              </Button>
              <Button asChild className="min-h-11 text-xs">
                <Link href={`/customers/${customer.id}`} onClick={onClose}>
                  <Icons.OpenInNew className="size-4" />
                  Abrir Cliente Completo
                </Link>
              </Button>
            </div>
          </SheetFooter>
        </div>
      )}
    </SheetModal>
  );
}
