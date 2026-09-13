"use client";

import { useState } from "react";

import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { Dialog } from "~/components/dialog";
import { StatusBadge } from "~/components/status-badge";

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date | string;
}

interface AuditDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  entry: AuditEntry | null;
}

const ACTION_TONES: Record<string, StatusTone> = {
  "user.create": "primary",
  "user.update": "warning",
  "price.update": "success",
  "inventory.adjust": "warning",
  "container.close": "primary",
  "cash.close": "neutral",
  "rate.update": "primary",
  "stock.transfer": "neutral",
  "stock.lock": "warning",
  "stock.unlock": "success",
  "repricing.approve": "success",
  "payment.create": "primary",
  "payment.validate": "success",
  "commission.pay": "success",
  "count.create": "neutral",
  "count.approve": "success",
  "warehouse.create": "primary",
  "ar.create": "warning",
  "ar.payment": "success",
  "ml.sync": "primary",
  "ml.import_order": "primary",
  "integration.resolve": "success",
};

export function AuditDetailsDialog({
  open,
  onClose,
  entry,
}: AuditDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<
    "changes" | "metadata" | "network"
  >("changes");
  const [copied, setCopied] = useState(false);

  if (!entry) return null;

  const actionTone = ACTION_TONES[entry.action] ?? "neutral";
  const formattedDate = new Date(entry.createdAt).toLocaleString("es-VE", {
    dateStyle: "full",
    timeStyle: "medium",
  });

  const handleCopyJson = (data: unknown) => {
    void navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasChanges = Boolean(entry.oldValue ?? entry.newValue);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalle de Auditoría"
      description={`Evento inmutable #${entry.id.slice(0, 8)}`}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Event Header Banner */}
        <div className="surface-card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge tone={actionTone}>{entry.action}</StatusBadge>
              <span className="text-muted-foreground font-mono text-xs">→</span>
              <span className="bg-secondary text-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium">
                {entry.entity}
              </span>
            </div>
            <time className="text-muted-foreground font-mono text-xs tabular-nums">
              {formattedDate}
            </time>
          </div>

          <div className="border-border/50 grid grid-cols-1 gap-2 border-t pt-2 text-xs sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                Actor / Responsable
              </span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Icons.Person className="text-muted-foreground size-3.5" />
                <span className="text-foreground font-medium">
                  {entry.actorName ?? "Sistema Automático"}
                </span>
                {entry.actorRole && (
                  <span className="text-muted-foreground font-mono text-[11px]">
                    ({entry.actorRole})
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                ID de Entidad
              </span>
              <span className="text-foreground mt-0.5 block truncate font-mono text-xs">
                {entry.entityId ?? "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="border-border flex items-center gap-1 border-b pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("changes")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "changes"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icons.SwapHoriz className="size-3.5" />
            Cambios / Datos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("metadata")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "metadata"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icons.Description className="size-3.5" />
            Metadatos Adicionales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("network")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "network"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icons.Policy className="size-3.5" />
            Traza & Red
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "changes" && (
          <div className="space-y-4">
            {hasChanges ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                      Valor Anterior
                    </span>
                    {entry.oldValue ? (
                      <button
                        type="button"
                        onClick={() => handleCopyJson(entry.oldValue)}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                      >
                        {copied ? (
                          <Icons.Check className="size-3" />
                        ) : (
                          <Icons.Description className="size-3" />
                        )}
                        Copiar
                      </button>
                    ) : null}
                  </div>
                  <pre className="bg-muted/40 border-border max-h-56 overflow-x-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
                    {entry.oldValue
                      ? JSON.stringify(entry.oldValue, null, 2)
                      : "Sin valor anterior registrado"}
                  </pre>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                      Nuevo Valor
                    </span>
                    {entry.newValue ? (
                      <button
                        type="button"
                        onClick={() => handleCopyJson(entry.newValue)}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                      >
                        {copied ? (
                          <Icons.Check className="size-3" />
                        ) : (
                          <Icons.Description className="size-3" />
                        )}
                        Copiar
                      </button>
                    ) : null}
                  </div>
                  <pre className="bg-muted/40 border-border max-h-56 overflow-x-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
                    {entry.newValue
                      ? JSON.stringify(entry.newValue, null, 2)
                      : "Sin nuevo valor registrado"}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 border-border text-muted-foreground rounded-lg border p-6 text-center text-xs">
                <Icons.Info className="text-muted-foreground/60 mb-1 block size-6" />
                Este evento fue registrado como una acción de ejecución sin
                diferencial de estado (sin oldValue ni newValue).
              </div>
            )}
          </div>
        )}

        {activeTab === "metadata" && (
          <div className="space-y-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Payload JSON
              </span>
              {entry.metadata ? (
                <button
                  type="button"
                  onClick={() => handleCopyJson(entry.metadata)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                >
                  {copied ? (
                    <Icons.Check className="size-3" />
                  ) : (
                    <Icons.Description className="size-3" />
                  )}
                  Copiar JSON
                </button>
              ) : null}
            </div>
            <pre className="bg-muted/40 border-border max-h-64 overflow-x-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
              {entry.metadata
                ? JSON.stringify(entry.metadata, null, 2)
                : "No hay metadatos adicionales en esta operación."}
            </pre>
          </div>
        )}

        {activeTab === "network" && (
          <div className="surface-card divide-border/60 divide-y text-xs">
            <div className="flex items-center justify-between p-3">
              <span className="text-muted-foreground font-medium">
                IP de Origen
              </span>
              <span className="text-foreground font-mono font-medium">
                {entry.ipAddress ?? "127.0.0.1 / Local"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-muted-foreground font-medium">
                Correlation ID
              </span>
              <span className="text-foreground font-mono">
                {entry.correlationId ?? "N/A"}
              </span>
            </div>
            <div className="space-y-1 p-3">
              <span className="text-muted-foreground block font-medium">
                User Agent / Dispositivo
              </span>
              <p className="text-foreground/80 bg-muted/40 border-border rounded border p-2 font-mono text-[11px] break-all">
                {entry.userAgent ??
                  "Cliente Web Interno (Next.js SSR / tRPC Client)"}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-secondary text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
          >
            Cerrar Inspector
          </button>
        </div>
      </div>
    </Dialog>
  );
}
