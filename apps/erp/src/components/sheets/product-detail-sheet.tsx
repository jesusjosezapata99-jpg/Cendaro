"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { SheetBody, SheetFooter, SheetModal } from "~/components/sheet-modal";
import { Skeleton } from "~/components/skeleton";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface ProductDetailSheetProps {
  open: boolean;
  onClose: () => void;
  productId: string;
}

export function ProductDetailSheet({
  open,
  onClose,
  productId,
}: ProductDetailSheetProps) {
  const trpc = useTRPC();

  const { data: product, isLoading } = useQuery(
    trpc.catalog.productById.queryOptions(
      { id: productId },
      { enabled: open && Boolean(productId) },
    ),
  );

  const badge = useMemo(() => {
    if (!product) return { label: "Activo", tone: "success" as const };
    return getStatus("product", product.status);
  }, [product]);

  const totalStock = useMemo(() => {
    if (!product) return 0;
    return product.stockLedger.reduce(
      (sum: number, s: { quantity: number }) => sum + s.quantity,
      0,
    );
  }, [product]);

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={product ? product.name : "Detalle de Producto"}
      description={
        product
          ? `SKU: ${product.sku} · Resumen de catálogo`
          : "Ficha de producto"
      }
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
      ) : !product ? (
        <SheetBody>
          <div className="py-12 text-center">
            <Icons.SearchOff className="text-muted-foreground mx-auto mb-2 block size-9" />
            <p className="text-foreground font-medium">
              Producto no encontrado
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              El producto solicitado no existe o fue eliminado.
            </p>
          </div>
        </SheetBody>
      ) : (
        <div className="flex h-full flex-col">
          <SheetBody>
            <div className="space-y-5">
              {/* Product Header */}
              <div className="border-border bg-card space-y-3 border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
                    <span className="text-muted-foreground font-mono text-xs">
                      ·
                    </span>
                    <span className="text-foreground font-mono text-xs font-medium">
                      SKU: {product.sku}
                    </span>
                  </div>
                  {product.barcode && (
                    <span className="text-muted-foreground font-mono text-xs">
                      Barras: {product.barcode}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-foreground text-base font-medium">
                    {product.name}
                  </h3>
                  {product.descriptionShort && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {product.descriptionShort}
                    </p>
                  )}
                </div>
              </div>

              {/* Stock KPI Summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border-border bg-card border p-3">
                  <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                    Stock Total
                  </span>
                  <span className="text-foreground font-mono text-lg font-medium tabular-nums">
                    {totalStock}
                  </span>
                  <span className="text-muted-foreground ml-1 text-[11px]">
                    unidades
                  </span>
                </div>
                <div className="border-border bg-card border p-3">
                  <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                    Almacenes
                  </span>
                  <span className="text-foreground font-mono text-lg font-medium tabular-nums">
                    {product.stockLedger.length}
                  </span>
                  <span className="text-muted-foreground ml-1 text-[11px]">
                    ubicaciones
                  </span>
                </div>
              </div>

              {/* Stock distribution */}
              {product.stockLedger.length > 0 && (
                <div>
                  <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                    Disponibilidad por Almacén
                  </h4>
                  <div className="border-border bg-card divide-border divide-y overflow-hidden border">
                    {product.stockLedger.map(
                      (s: {
                        id: string;
                        warehouseId: string;
                        quantity: number;
                        isLocked: boolean;
                      }) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 text-xs"
                        >
                          <span className="text-foreground font-mono">
                            Almacén {s.warehouseId.slice(0, 8)}
                          </span>
                          <span className="text-foreground font-mono font-medium tabular-nums">
                            {s.quantity} uds
                            {s.isLocked && (
                              <span className="ml-1.5 text-[11px] text-amber-500">
                                (bloqueado)
                              </span>
                            )}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
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
                <Link href={`/catalog/${product.id}`} onClick={onClose}>
                  <Icons.OpenInNew className="size-4" />
                  Abrir Producto Completo
                </Link>
              </Button>
            </div>
          </SheetFooter>
        </div>
      )}
    </SheetModal>
  );
}
