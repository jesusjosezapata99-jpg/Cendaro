"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

interface PosPaymentPanelProps {
  subtotal: number;
  discount: number;
  cartDual: { usd: string; bs: string };
  disabled: boolean;
  onCheckout: () => void;
}

export function PosPaymentPanel({
  subtotal,
  discount,
  cartDual,
  disabled,
  onCheckout,
}: PosPaymentPanelProps) {
  return (
    <div className="border-border/60 space-y-3 border-t pt-3">
      {/* Financial Breakdown */}
      <div className="space-y-1.5 text-xs">
        <div className="text-muted-foreground flex justify-between">
          <span>Subtotal:</span>
          <span className="font-mono tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between font-medium text-emerald-500">
            <span>Descuento:</span>
            <span className="font-mono tabular-nums">
              -${discount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="border-border/40 my-1 border-t" />

        {/* Grand Total — text-4xl font-mono tabular-nums per spec T6.2 */}
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-foreground text-xs font-medium tracking-wider uppercase">
            TOTAL A COBRAR:
          </span>
          <div className="text-right">
            <div className="text-foreground font-mono text-4xl font-black tracking-tight tabular-nums">
              {cartDual.usd}
            </div>
            <div className="text-primary mt-0.5 font-mono text-xs font-medium tabular-nums">
              {cartDual.bs}
            </div>
          </div>
        </div>
      </div>

      {/* Big Action Button: Cobrar Venta with F4 shortcut hint */}
      <Button
        type="button"
        onClick={onCheckout}
        disabled={disabled}
        className="min-h-14 w-full text-base font-medium shadow-md transition-transform active:scale-[0.99]"
      >
        <Icons.Payments className="size-5" />
        Cobrar Venta ({cartDual.usd})
        <kbd className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20 ml-2 hidden border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
          F4
        </kbd>
      </Button>
    </div>
  );
}
