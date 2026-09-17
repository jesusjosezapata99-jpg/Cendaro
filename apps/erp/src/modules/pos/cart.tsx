"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import {
  FISCAL_ID_TYPE_LABELS,
  fiscalIdTypeOf,
  isFiscalInvoiceReady,
} from "@cendaro/validators";

import type { CartLine, CustomerInfo } from "./types";
import { Can } from "~/components/role-guard";
import { formatDualCurrency } from "~/lib/format-currency";

interface PosCartProps {
  cart: CartLine[];
  bcvRate: number;
  selectedCustomer: CustomerInfo | null;
  onSelectCustomer: (customer: CustomerInfo | null) => void;
  onCreateCustomer: () => void;
  /** Opens the selected customer's form to complete their fiscal data. */
  onEditCustomer: () => void;
  customers: CustomerInfo[];
  customerSearch: string;
  onCustomerSearchChange: (q: string) => void;
  showCustomerDropdown: boolean;
  onToggleCustomerDropdown: (open?: boolean) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  onRemoveLine: (id: string) => void;
}

export function PosCart({
  cart,
  bcvRate,
  selectedCustomer,
  onSelectCustomer,
  onCreateCustomer,
  onEditCustomer,
  customers,
  customerSearch,
  onCustomerSearchChange,
  showCustomerDropdown,
  onToggleCustomerDropdown,
  onUpdateQuantity,
  onUpdateUnitPrice,
  onRemoveLine,
}: PosCartProps) {
  // `customers` is already filtered server-side by `customerSearch`.
  const selectedIdType = fiscalIdTypeOf(selectedCustomer?.identification);
  const selectedFiscalReady = selectedCustomer
    ? isFiscalInvoiceReady(selectedCustomer)
    : true;

  return (
    <div>
      {/* Ticket Top: Title & Customer Selector */}
      <div className="border-border/60 border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Receipt className="text-primary size-5" />
            <h3 className="text-foreground text-xs font-medium tracking-wider uppercase">
              Ticket de Venta (Mostrador)
            </h3>
          </div>
          <Can module="customers" action="create">
            <Button
              type="button"
              variant="outline"
              onClick={onCreateCustomer}
              className="min-h-8 px-2.5 text-[11px] font-medium"
            >
              <Icons.PersonAdd className="size-3" />+ Nuevo Cliente
            </Button>
          </Can>
        </div>

        {/* Customer Dropdown Selector */}
        <div className="relative mt-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onToggleCustomerDropdown()}
              className="border-border bg-secondary/60 hover:bg-secondary flex min-h-11 flex-1 items-center justify-between border px-3 py-2 text-left transition-colors"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icons.Person className="text-muted-foreground size-4 shrink-0" />
                <div className="truncate">
                  <span className="text-foreground block truncate text-xs font-medium">
                    {selectedCustomer
                      ? selectedCustomer.name
                      : "Consumidor Final"}
                  </span>
                  <span className="text-muted-foreground block truncate font-mono text-[10px]">
                    {selectedCustomer?.identification
                      ? `${selectedIdType ? FISCAL_ID_TYPE_LABELS[selectedIdType] : "Doc."}: ${selectedCustomer.identification}`
                      : "Sin documento · Detal"}
                  </span>
                </div>
              </div>
              <Icons.ExpandMore className="text-muted-foreground size-4 shrink-0" />
            </button>

            {selectedCustomer && (
              <button
                type="button"
                onClick={() => onSelectCustomer(null)}
                className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 items-center justify-center p-2"
                title="Restablecer a Consumidor Final"
              >
                <Icons.Close className="size-4" />
              </button>
            )}
          </div>

          {!selectedFiscalReady && (
            <div
              role="status"
              className="bg-status-warning-bg text-status-warning-fg mt-1.5 flex items-start gap-1.5 px-2 py-1.5 text-[11px]"
            >
              <Icons.Warning className="mt-px size-3.5 shrink-0" />
              <div className="flex-1">
                <p>
                  Datos fiscales incompletos para factura SENIAT (documento
                  válido y domicilio fiscal). No se puede cobrar a este cliente
                  hasta completarlos.
                </p>
                <Can
                  module="customers"
                  action="update"
                  fallback={
                    <p className="mt-1">
                      Pide a un supervisor que complete la ficha, o cobra como
                      Consumidor Final.
                    </p>
                  }
                >
                  <button
                    type="button"
                    onClick={onEditCustomer}
                    className="mt-1 font-medium underline underline-offset-2"
                  >
                    Completar datos del cliente
                  </button>
                </Can>
              </div>
            </div>
          )}

          {/* Dropdown Menu */}
          {showCustomerDropdown && (
            <div className="border-border bg-card absolute z-30 mt-1 max-h-64 w-full overflow-auto border p-2 shadow-md">
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <input
                  id="pos-customer-search-input"
                  name="pos-customer-search"
                  type="text"
                  placeholder="Buscar cliente..."
                  aria-label="Buscar cliente"
                  value={customerSearch}
                  onChange={(e) => onCustomerSearchChange(e.target.value)}
                  className="border-border bg-secondary text-foreground w-full border px-2.5 py-1.5 text-xs focus:outline-none"
                />
                <Can module="customers" action="create">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCustomerDropdown(false);
                      onCreateCustomer();
                    }}
                    className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 flex size-8 shrink-0 items-center justify-center border text-xs"
                    title="Crear cliente nuevo"
                    aria-label="Crear cliente nuevo"
                  >
                    <Icons.PersonAdd className="size-3.5" />
                  </button>
                </Can>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null);
                  onToggleCustomerDropdown(false);
                }}
                className="hover:bg-secondary flex min-h-10 w-full items-center justify-between p-2 text-left text-xs transition-colors"
              >
                <span className="text-foreground font-medium">
                  Consumidor Final
                </span>
                <span className="text-muted-foreground text-[10px]">
                  Por defecto
                </span>
              </button>

              {customers.length === 0 && customerSearch.trim() && (
                <p className="text-muted-foreground p-2 text-[11px]">
                  Sin resultados. Registra al cliente con el botón +.
                </p>
              )}

              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(c);
                    onToggleCustomerDropdown(false);
                  }}
                  className="hover:bg-secondary flex min-h-11 w-full items-center justify-between p-2 text-left text-xs transition-colors"
                >
                  <div className="truncate pr-2">
                    <span className="text-foreground block truncate font-medium">
                      {c.name}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {c.identification ?? "Sin documento"}
                    </span>
                  </div>
                  {c.phone && (
                    <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
                      {c.phone}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Items Scrollable List */}
      <div className="divide-border/40 max-h-90 min-h-55 divide-y overflow-y-auto py-2 pr-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.ShoppingCartOff className="text-muted-foreground/40 size-9" />
            <p className="text-muted-foreground mt-2 text-xs font-medium">
              El ticket está vacío
            </p>
            <p className="text-muted-foreground/80 mt-0.5 text-[11px]">
              Escanee un código de barras o haga tap en los artículos
            </p>
          </div>
        ) : (
          cart.map((line) => {
            const lineDual = formatDualCurrency(line.lineTotal, bcvRate);
            return (
              <div
                key={line.id}
                className="flex items-center justify-between py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-foreground line-clamp-1 leading-tight font-medium">
                    {line.name}
                  </p>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="truncate">{line.sku}</span>
                    <span>·</span>
                    <span className="shrink-0">
                      $
                      <input
                        id={`pos-unit-price-${line.id}`}
                        name={`pos-unit-price-${line.id}`}
                        type="number"
                        step="0.5"
                        min="0"
                        aria-label={`Precio unitario para ${line.name}`}
                        value={line.unitPrice}
                        onChange={(e) =>
                          onUpdateUnitPrice(
                            line.id,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="border-border bg-secondary text-foreground w-12 border px-1 py-0.5 font-mono text-[10px] tabular-nums"
                      />
                    </span>
                  </div>
                </div>

                {/* Quantity Stepper with touch targets ≥44px */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(line.id, -1)}
                    className="border-border bg-secondary text-foreground hover:bg-accent flex min-h-9 min-w-9 items-center justify-center border font-medium active:scale-95"
                    aria-label="Disminuir cantidad"
                  >
                    -
                  </button>
                  <span className="text-foreground w-7 text-center font-mono font-medium tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(line.id, 1)}
                    className="border-border bg-secondary text-foreground hover:bg-accent flex min-h-9 min-w-9 items-center justify-center border font-medium active:scale-95"
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>

                {/* Line Total & Remove */}
                <div className="flex shrink-0 items-center gap-2 pl-3">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-foreground font-medium">
                      {lineDual.usd}
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      {lineDual.bs}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.id)}
                    className="text-muted-foreground hover:text-destructive flex min-h-9 min-w-9 items-center justify-center transition-colors"
                    aria-label="Eliminar ítem"
                  >
                    <Icons.Delete className="size-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
