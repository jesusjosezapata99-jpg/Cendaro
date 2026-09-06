"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  Field,
  FormActions,
  Input,
  TextArea,
} from "~/components/dialog";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateClosureDialog({ open, onClose }: Props) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [form, setForm] = useState({
    closureDate: new Date().toISOString().split("T")[0] ?? "",
    totalSales: "",
    totalCash: "",
    totalDigital: "",
    expectedTotal: "",
    actualTotal: "",
    notes: "",
  });

  const create = useMutation(
    trpc.sales.createClosure.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["payments"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
        setForm({
          closureDate: new Date().toISOString().split("T")[0] ?? "",
          totalSales: "",
          totalCash: "",
          totalDigital: "",
          expectedTotal: "",
          actualTotal: "",
          notes: "",
        });
        onClose();
      },
    }),
  );

  const expected = parseFloat(form.expectedTotal) || 0;
  const actual = parseFloat(form.actualTotal) || 0;
  const discrepancy = useMemo(() => actual - expected, [actual, expected]);
  const hasEnteredTotals = form.expectedTotal !== "" && form.actualTotal !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      closureDate: new Date(`${form.closureDate}T12:00:00.000Z`).toISOString(),
      totalSales: parseFloat(form.totalSales) || 0,
      totalCash: parseFloat(form.totalCash) || 0,
      totalDigital: parseFloat(form.totalDigital) || 0,
      expectedTotal: expected,
      actualTotal: actual,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cerrar Día (Arqueo de Caja)"
      description="Registra el cierre de caja diario y la conciliación física de fondos."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Fecha de Cierre" required>
          <Input
            type="date"
            required
            value={form.closureDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, closureDate: e.target.value }))
            }
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Total Ventas ($)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.totalSales}
              onChange={(e) =>
                setForm((f) => ({ ...f, totalSales: e.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>
          <Field label="Efectivo Físico ($)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.totalCash}
              onChange={(e) =>
                setForm((f) => ({ ...f, totalCash: e.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>
          <Field label="Digital / Bancos ($)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.totalDigital}
              onChange={(e) =>
                setForm((f) => ({ ...f, totalDigital: e.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Total Esperado ($)"
            required
            hint="Suma teórica del sistema"
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.expectedTotal}
              onChange={(e) =>
                setForm((f) => ({ ...f, expectedTotal: e.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>
          <Field
            label="Total Real en Caja ($)"
            required
            hint="Conteo físico / efectivo + vouchers"
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.actualTotal}
              onChange={(e) =>
                setForm((f) => ({ ...f, actualTotal: e.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>
        </div>

        {/* Dynamic Discrepancy Calculator Card */}
        {hasEnteredTotals && (
          <div
            className={`rounded-lg border p-3 transition-colors ${
              Math.abs(discrepancy) < 0.01
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : discrepancy < 0
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="material-symbols-outlined text-base">
                  {Math.abs(discrepancy) < 0.01
                    ? "check_circle"
                    : discrepancy < 0
                      ? "warning"
                      : "info"}
                </span>
                <span>
                  {Math.abs(discrepancy) < 0.01
                    ? "Caja Cuadrada (Sin discrepancias)"
                    : discrepancy < 0
                      ? "Faltante en Caja"
                      : "Sobrante en Caja"}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {discrepancy >= 0 ? "+" : ""}${discrepancy.toFixed(2)}
                </span>
                {bcv.rate > 0 && Math.abs(discrepancy) >= 0.01 && (
                  <p className="font-mono text-[10px] tabular-nums opacity-80">
                    {formatDualCurrency(Math.abs(discrepancy), bcv.rate).bs}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <Field label="Notas / Observaciones del Arqueo">
          <TextArea
            rows={2}
            placeholder="Explicación de discrepancias, incidencias o detalles del arqueo..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Field>

        <FormActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Registrar Cierre"
        />
      </form>
    </Dialog>
  );
}
