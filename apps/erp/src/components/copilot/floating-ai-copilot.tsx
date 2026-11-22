"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";

import type { StatusTone } from "@cendaro/ui/status-pill";
import type {
  CopilotChatResponse,
  CopilotHistoryTurn,
  QuickQueryIntentType,
  UserRole,
} from "@cendaro/validators";
import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";
import { can } from "@cendaro/validators";

import { useCurrentUser } from "~/hooks/use-current-user";
import { useWorkspace } from "~/hooks/use-workspace";
import { easeOutExpo } from "~/lib/motion";
import { useTRPC } from "~/trpc/client";
import { CopilotCoreSvg } from "./copilot-core-svg";

const MAX_IN_MEMORY_TURNS = 20;
const MAX_HISTORY_CONTEXT = 6;
const COPY_FEEDBACK_MS = 1_500;

interface ConversationTurn {
  id: string;
  userText: string;
  createdAt: number;
  response?: CopilotChatResponse;
  errorText?: string;
}

export interface StarterPrompt {
  id: string;
  prompt: string;
}

export interface CopilotModuleContext {
  moduleLabel: string;
  starters: StarterPrompt[];
}

/**
 * Merges slide-over sheet query params (`?orderId=`, `?customerId=`, `?productId=`)
 * onto the current URL query string so active `nuqs` table filters are never lost,
 * and flags `opensGlobalSheet: true` so the Copilot minimizes out of the `z-50` Sheet's way.
 */
export function buildMergedSheetHref(
  pathname: string,
  currentSearch: string,
  actionHref: string,
): { nextUrl: string; opensGlobalSheet: boolean } {
  if (!actionHref.startsWith("?")) {
    return { nextUrl: actionHref, opensGlobalSheet: false };
  }

  const baseParams = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  const incomingParams = new URLSearchParams(actionHref.slice(1));

  // Clear mutually exclusive GlobalSheets detail keys before setting the requested sheet
  for (const sheetKey of ["orderId", "customerId", "productId"]) {
    if (incomingParams.has(sheetKey)) {
      baseParams.delete("orderId");
      baseParams.delete("customerId");
      baseParams.delete("productId");
      break;
    }
  }

  incomingParams.forEach((value, key) => {
    baseParams.set(key, value);
  });

  const qs = baseParams.toString();
  return {
    nextUrl: qs.length > 0 ? `${pathname}?${qs}` : pathname,
    opensGlobalSheet: true,
  };
}

/**
 * Resolves the active ERP module label and role-authorized starter prompts
 * tailored to the screen the user is currently viewing (`pathname`).
 */
export function resolveCopilotModuleContext(
  pathname: string,
  role: UserRole,
): CopilotModuleContext {
  const canOrders = can(role, "orders", "read");
  const canPayments = can(role, "payments", "read");
  const canAr = can(role, "receivables", "read");
  const canInventory = can(role, "inventory", "read");
  const canCatalog = can(role, "catalog", "read");
  const canContainers = can(role, "containers", "read");
  const canCash = can(role, "cash_closure", "read");
  const canVendors = can(role, "vendors", "read");
  const canAlerts = can(role, "dashboard", "update");

  const candidates: StarterPrompt[] = [];
  const pushPrompt = (id: string, prompt: string, allowed: boolean) => {
    if (allowed && !candidates.some((c) => c.id === id)) {
      candidates.push({ id, prompt });
    }
  };

  let moduleLabel = "Vista general";

  if (pathname.startsWith("/invoices")) {
    moduleLabel = "Facturación";
    pushPrompt("inv-last", "¿Cuál fue la última factura emitida?", canOrders);
    pushPrompt(
      "pay-today",
      "¿Qué pagos entraron hoy y con qué referencia?",
      canPayments,
    );
    pushPrompt(
      "ar-overdue",
      "¿Cuáles cuentas por cobrar están vencidas?",
      canAr,
    );
    pushPrompt(
      "cn-recent",
      "¿Cuáles fueron las últimas notas de crédito?",
      canOrders,
    );
  } else if (
    pathname.startsWith("/orders") ||
    pathname.startsWith("/delivery-notes")
  ) {
    moduleLabel = pathname.startsWith("/delivery-notes")
      ? "Notas de Entrega"
      : "Pedidos y Ventas";
    pushPrompt("ord-dispatch", "¿Qué pedidos faltan por despachar?", canOrders);
    pushPrompt(
      "ord-unpaid",
      "¿Cuáles pedidos tienen saldo sin pagar?",
      canOrders,
    );
    pushPrompt("inv-last", "¿Cuál fue la última factura emitida?", canOrders);
    pushPrompt("dn-last", "¿Cuál fue la última nota de entrega?", canOrders);
  } else if (pathname.startsWith("/quotes")) {
    moduleLabel = "Cotizaciones";
    pushPrompt(
      "qt-open",
      "¿Qué cotizaciones vigentes están abiertas?",
      canOrders,
    );
    pushPrompt("sales-week", "¿Cuánto hemos vendido esta semana?", canOrders);
    pushPrompt("bcv-rate", "¿A cómo está el dólar BCV hoy?", true);
  } else if (pathname.startsWith("/accounts-receivable")) {
    moduleLabel = "Cuentas por Cobrar";
    pushPrompt(
      "ar-overdue",
      "¿Cuáles cuentas por cobrar están vencidas?",
      canAr,
    );
    pushPrompt("ar-over-500", "¿Qué cuentas abiertas superan los $500?", canAr);
    pushPrompt("pay-today", "¿Qué cobros se registraron hoy?", canPayments);
  } else if (pathname.startsWith("/payments")) {
    moduleLabel = "Pagos y Cobros";
    pushPrompt("pay-today", "¿Qué pagos entraron hoy?", canPayments);
    pushPrompt(
      "pay-zelle",
      "¿Cuáles fueron los últimos pagos por Zelle?",
      canPayments,
    );
    pushPrompt(
      "ord-unpaid",
      "¿Cuáles pedidos siguen pendientes de pago?",
      canOrders,
    );
  } else if (pathname.startsWith("/cash-closure")) {
    moduleLabel = "Cierre de Caja";
    pushPrompt("cash-last", "¿Cómo estuvo el último cierre de caja?", canCash);
    pushPrompt("pay-today", "¿Qué pagos entraron hoy?", canPayments);
    pushPrompt("sales-today", "¿Cuánto hemos vendido hoy?", canOrders);
  } else if (pathname.startsWith("/inventory")) {
    moduleLabel = "Inventario y Kardex";
    pushPrompt("inv-low", "¿Qué productos tienen stock crítico?", canInventory);
    pushPrompt(
      "inv-zero",
      "¿Cuáles productos están agotados en cero?",
      canInventory,
    );
    pushPrompt("inv-wh", "¿Cómo está el inventario por almacén?", canInventory);
    pushPrompt(
      "cont-transit",
      "¿Qué contenedores vienen en tránsito?",
      canContainers,
    );
  } else if (pathname.startsWith("/catalog")) {
    moduleLabel = "Catálogo y Precios";
    pushPrompt(
      "top-prod",
      "¿Cuáles son los productos más vendidos?",
      canOrders,
    );
    pushPrompt("inv-low", "¿Qué productos tienen stock bajo?", canInventory);
    pushPrompt("sup-list", "¿Qué proveedores tenemos activos?", canCatalog);
    pushPrompt("bcv-rate", "¿A cómo está la tasa BCV hoy?", true);
  } else if (pathname.startsWith("/containers")) {
    moduleLabel = "Contenedores";
    pushPrompt(
      "cont-transit",
      "¿Qué contenedores vienen en tránsito?",
      canContainers,
    );
    pushPrompt("inv-low", "¿Qué productos están por agotarse?", canInventory);
    pushPrompt("rmb-rate", "¿A cómo está la tasa RMB y BCV hoy?", true);
  } else if (pathname.startsWith("/pos")) {
    moduleLabel = "Punto de Venta";
    pushPrompt("bcv-rate", "¿A cómo está el dólar BCV hoy?", true);
    pushPrompt("pay-today", "¿Qué cobros han entrado hoy?", canPayments);
    pushPrompt("inv-low", "¿Qué productos tienen stock bajo?", canInventory);
  } else if (pathname.startsWith("/vendors")) {
    moduleLabel = "Vendedores";
    pushPrompt(
      "vend-comm",
      "¿Cómo están las comisiones por liquidar?",
      canVendors,
    );
    pushPrompt("sales-week", "¿Cuánto hemos vendido esta semana?", canOrders);
  } else if (pathname.startsWith("/alerts")) {
    moduleLabel = "Alertas y Aprobaciones";
    pushPrompt(
      "appr-pend",
      "¿Qué aprobaciones y alertas están pendientes?",
      canAlerts,
    );
    pushPrompt("pulse", "¿Cómo vamos hoy en la operación?", true);
  } else if (pathname.startsWith("/customers")) {
    moduleLabel = "Clientes";
    pushPrompt("ar-overdue", "¿Qué clientes tienen cuentas vencidas?", canAr);
    pushPrompt("inv-last", "¿Cuál fue la última factura emitida?", canOrders);
    pushPrompt("ord-dispatch", "¿Qué pedidos están pendientes?", canOrders);
  } else if (pathname.startsWith("/rates")) {
    moduleLabel = "Tasas de Cambio";
    pushPrompt("bcv-rate", "¿A cómo está el dólar BCV y el yuan hoy?", true);
    pushPrompt("conv-demo", "Convierte 250 dólares a bolívares", true);
  }

  // Fill remaining slots up to 4 balanced prompts for the role
  pushPrompt("pulse", "¿Cómo vamos hoy?", true);
  pushPrompt("inv-last", "¿Cuál fue la última factura emitida?", canOrders);
  pushPrompt("ar-overdue", "¿Cuáles cuentas por cobrar están vencidas?", canAr);
  pushPrompt("inv-low", "¿Qué productos tienen stock bajo?", canInventory);
  pushPrompt("bcv-rate", "¿A cómo está el dólar BCV hoy?", true);

  return {
    moduleLabel,
    starters: candidates.slice(0, 4),
  };
}

function mapKpiToneToTextClass(tone?: StatusTone): string {
  switch (tone) {
    case "success":
      return "text-status-success-fg";
    case "warning":
      return "text-status-warning-fg";
    case "destructive":
      return "text-status-destructive-fg";
    case "info":
      return "text-status-info-fg";
    default:
      return "text-foreground";
  }
}

function mapSourceLabel(
  source: CopilotChatResponse["source"],
  accessDenied?: boolean,
): { label: string; tone: StatusTone } {
  if (accessDenied) {
    return { label: "Alcance de rol", tone: "warning" };
  }
  switch (source) {
    case "gemini-flash-lite":
      return { label: "IA Conversacional", tone: "info" };
    case "cache":
      return { label: "Memoria activa", tone: "neutral" };
    case "degraded":
      return { label: "Motor local", tone: "neutral" };
    default:
      return { label: "Tiempo real", tone: "success" };
  }
}

function renderDomainRowIcon(intent: QuickQueryIntentType) {
  switch (intent) {
    case "invoice_lookup":
    case "credit_note_lookup":
    case "delivery_note_lookup":
      return (
        <Icons.ReceiptLong className="text-muted-foreground size-4 shrink-0" />
      );
    case "payment_lookup":
    case "cash_closure_status":
    case "overdue_receivables":
    case "pending_receivables":
      return (
        <Icons.Payments className="text-muted-foreground size-4 shrink-0" />
      );
    case "customer_lookup":
    case "supplier_lookup":
    case "vendor_commissions_lookup":
      return <Icons.Person className="text-muted-foreground size-4 shrink-0" />;
    case "low_stock":
    case "catalog_lookup":
    case "warehouse_stock_lookup":
      return (
        <Icons.Inventory2 className="text-muted-foreground size-4 shrink-0" />
      );
    case "containers_status":
      return (
        <Icons.DirectionsBoat className="text-muted-foreground size-4 shrink-0" />
      );
    case "open_quotes":
      return (
        <Icons.RequestQuote className="text-muted-foreground size-4 shrink-0" />
      );
    case "sales_summary":
    case "top_products":
    case "daily_pulse":
      return (
        <Icons.TrendingUp className="text-muted-foreground size-4 shrink-0" />
      );
    case "approvals_alerts_lookup":
      return (
        <Icons.Warning className="text-muted-foreground size-4 shrink-0" />
      );
    case "exchange_rate":
      return (
        <Icons.CurrencyExchange className="text-muted-foreground size-4 shrink-0" />
      );
    case "erp_help":
      return <Icons.Help className="text-muted-foreground size-4 shrink-0" />;
    default:
      return (
        <Icons.FactCheck className="text-muted-foreground size-4 shrink-0" />
      );
  }
}

function hasActiveModalDialogLayer(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

function buildCopyDigestText(res: CopilotChatResponse): string {
  const lines = [res.headline, res.reply];
  for (const field of res.details) {
    lines.push(`${field.label}: ${field.value}`);
  }
  for (const kpi of res.kpis) {
    lines.push(`${kpi.label}: ${kpi.value}`);
  }
  return lines.join("\n");
}

interface CopilotSessionProps {
  fullName: string;
  role: UserRole;
  roleLabel: string;
}

function FloatingAiCopilotSession({
  fullName,
  role,
  roleLabel,
}: CopilotSessionProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpandedWidth, setIsExpandedWidth] = useState(false);
  const [isLauncherHovered, setIsLauncherHovered] = useState(false);
  const [draft, setDraft] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Strictly in-memory React state inside AppShell: persists across SPA route
  // transitions while guaranteeing 0% cleartext PII / balances in browser storage.
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const activeTurnIdRef = useRef<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = useMemo(() => {
    const token = fullName.trim().split(/\s+/)[0];
    return token && token.length > 0 ? token : "equipo";
  }, [fullName]);

  const isManagementView = can(role, "receivables", "read");
  const moduleContext = useMemo(
    () => resolveCopilotModuleContext(pathname, role),
    [pathname, role],
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!hasActiveModalDialogLayer()) {
        textareaRef.current?.focus();
      }
      threadEndRef.current?.scrollIntoView({ behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Global keyboard coordination: Ctrl+. / Cmd+. and Escape (defers to z-50 Radix Dialog/Sheet layers)
  useEffect(() => {
    function onWindowKeyDown(e: KeyboardEvent) {
      if (hasActiveModalDialogLayer()) return;

      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [isOpen]);

  const chatMutation = useMutation(
    trpc.search.copilotChat.mutationOptions({
      onSuccess: (data) => {
        const targetId = activeTurnIdRef.current;
        activeTurnIdRef.current = null;
        setTurns((prev) =>
          prev.map((entry) =>
            entry.id === targetId ? { ...entry, response: data } : entry,
          ),
        );
        requestAnimationFrame(() => {
          threadEndRef.current?.scrollIntoView({
            behavior: prefersReducedMotion ? "instant" : "smooth",
          });
        });
      },
      onError: (err) => {
        const targetId = activeTurnIdRef.current;
        activeTurnIdRef.current = null;
        const friendlyError =
          err.message ||
          "No se pudo completar la consulta en este momento. Intenta de nuevo en unos segundos.";
        setTurns((prev) =>
          prev.map((entry) =>
            entry.id === targetId
              ? { ...entry, errorText: friendlyError }
              : entry,
          ),
        );
      },
    }),
  );

  const sendMessage = useCallback(
    (rawText: string) => {
      const clean = rawText.trim();
      if (clean.length < 2 || chatMutation.isPending) return;

      const historyPayload: CopilotHistoryTurn[] = turns
        .filter(
          (t): t is ConversationTurn & { response: CopilotChatResponse } =>
            Boolean(t.response),
        )
        .slice(-MAX_HISTORY_CONTEXT)
        .map((t) => ({
          userText: t.userText.slice(0, 240),
          intent: t.response.intent,
          searchTerm: t.response.resolvedFilters.searchTerm ?? null,
          documentNumber: t.response.resolvedFilters.documentNumber ?? null,
          orderSubfilter: t.response.resolvedFilters.orderSubfilter ?? null,
          channel: t.response.resolvedFilters.channel ?? null,
          paymentMethod: t.response.resolvedFilters.paymentMethod ?? null,
          timeWindow: t.response.resolvedFilters.timeWindow ?? null,
          minAmountUsd: t.response.resolvedFilters.minAmountUsd ?? null,
          onlyOutOfStock: t.response.resolvedFilters.onlyOutOfStock ?? null,
        }));

      const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeTurnIdRef.current = turnId;

      setTurns((prev) => [
        ...prev.slice(-(MAX_IN_MEMORY_TURNS - 1)),
        {
          id: turnId,
          userText: clean,
          createdAt: Date.now(),
        },
      ]);
      setDraft("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      requestAnimationFrame(() => {
        threadEndRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? "instant" : "smooth",
        });
      });

      chatMutation.mutate({
        message: clean,
        history: historyPayload,
      });
    },
    [chatMutation, prefersReducedMotion, turns],
  );

  function handleRetryTurn(failedTurnId: string, originalText: string) {
    if (chatMutation.isPending) return;
    setTurns((prev) => prev.filter((t) => t.id !== failedTurnId));
    sendMessage(originalText);
  }

  function handleResetConversation() {
    if (chatMutation.isPending) return;
    setTurns([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleCopyText(key: string, value: string) {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopiedKey(key);
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = setTimeout(() => {
          setCopiedKey((current) => (current === key ? null : current));
        }, COPY_FEEDBACK_MS);
      })
      .catch(() => undefined);
  }

  function handleNavigate(href: string) {
    const currentSearch =
      typeof window !== "undefined" ? window.location.search : "";
    const { nextUrl, opensGlobalSheet } = buildMergedSheetHref(
      pathname,
      currentSearch,
      href,
    );
    if (opensGlobalSheet) {
      setIsOpen(false);
    }
    router.push(nextUrl);
  }

  const launcherSvgState = chatMutation.isPending
    ? "thinking"
    : isLauncherHovered
      ? "hovered"
      : "idle";

  const latestCompletedTurn = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const candidate = turns[i];
      if (candidate?.response) return candidate;
    }
    return null;
  }, [turns]);

  return (
    <div
      className={cn(
        "safe-pb fixed z-40",
        isOpen
          ? "inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5"
          : "right-4 bottom-4 sm:right-5 sm:bottom-5",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <m.section
            key="cendaro-copilot-panel"
            aria-label="Asistente conversacional Cendaro"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.985 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 8, scale: 0.99 }
            }
            transition={{ duration: 0.2, ease: easeOutExpo }}
            className={cn(
              "border-border bg-background flex h-[min(640px,calc(100dvh-1.75rem))] w-full flex-col border shadow-md sm:h-[min(640px,calc(100dvh-2.5rem))]",
              isExpandedWidth ? "sm:w-[580px]" : "sm:w-[420px]",
            )}
          >
            {/* Architectural Header */}
            <header className="border-border bg-card flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="border-border bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center border">
                  <CopilotCoreSvg
                    state={chatMutation.isPending ? "thinking" : "open"}
                    size={20}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground truncate text-sm font-medium tracking-tight">
                      Cendaro IA
                    </h2>
                    <StatusPill tone="neutral" className="shrink-0">
                      {roleLabel}
                    </StatusPill>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {chatMutation.isPending ? (
                      <span>
                        Consultando datos operativos
                        <span className="loading-ellipsis" />
                      </span>
                    ) : (
                      `Contexto: ${moduleContext.moduleLabel}`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsExpandedWidth((prev) => !prev)}
                  title={
                    isExpandedWidth
                      ? "Vista compacta (420px)"
                      : "Modo inspector amplio (580px)"
                  }
                  aria-label={
                    isExpandedWidth
                      ? "Cambiar a ancho compacto"
                      : "Expandir ancho del asistente"
                  }
                  className="text-muted-foreground hover:bg-accent hover:text-foreground hidden size-9 cursor-pointer items-center justify-center transition-colors md:flex"
                >
                  <Icons.SwapHoriz className="size-4" />
                </button>
                {turns.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleResetConversation}
                    disabled={chatMutation.isPending}
                    title="Nueva conversación"
                    aria-label="Iniciar nueva conversación"
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 cursor-pointer items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icons.Refresh className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Minimizar asistente (Escape)"
                  aria-label="Minimizar asistente"
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 cursor-pointer items-center justify-center transition-colors"
                >
                  <Icons.Close className="size-4" />
                </button>
              </div>
            </header>

            {/* Conversation Stream */}
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div className="flex flex-col gap-5">
                  {/* Editorial Greeting (Hedvig Letters Serif) */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-tag text-tag-foreground inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-xs">
                        {moduleContext.moduleLabel}
                      </span>
                    </div>
                    <h3 className="text-foreground font-serif text-lg font-normal tracking-tight">
                      Hola, {firstName}.
                    </h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {isManagementView
                        ? "Consulta con lenguaje natural la última factura o pago de cualquier empresa, cuentas vencidas, cierres de caja, existencias por almacén o contenedores."
                        : "Consulta con normalidad la última factura o pedido de un cliente, cómo pagó, precios en USD y Bs. a BCV, existencias o tus cotizaciones."}
                    </p>
                  </div>

                  {/* Indexed Module-Contextual Starter Ledger */}
                  <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Consultas rápidas sugeridas
                    </span>
                    <div className="border-border divide-border bg-surface flex flex-col divide-y border">
                      {moduleContext.starters.map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => sendMessage(item.prompt)}
                          className="hover:bg-row-hover group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="text-foreground text-xs font-medium">
                              {item.prompt}
                            </span>
                          </div>
                          <Icons.ArrowForward className="text-muted-foreground group-hover:text-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                turns.map((turn) => {
                  const isLatest = latestCompletedTurn?.id === turn.id;
                  const res = turn.response;
                  const sourceBadge = res
                    ? mapSourceLabel(res.source, res.accessDenied)
                    : null;
                  const turnCopyKey = `turn:${turn.id}`;

                  return (
                    <div key={turn.id} className="flex flex-col gap-2.5">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground max-w-[85%] px-3.5 py-2 text-xs leading-relaxed">
                          {turn.userText}
                        </div>
                      </div>

                      {/* Assistant Ledger Card (Single-Border Hairline Architecture) */}
                      {res ? (
                        <article className="border-border divide-border bg-surface flex flex-col divide-y border">
                          {/* Section 1: Headline + Status + Copy Digest + Natural Synthesis */}
                          <div className="flex flex-col gap-2 p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-foreground text-xs leading-snug font-medium">
                                {res.headline}
                              </span>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {sourceBadge ? (
                                  <StatusPill
                                    tone={sourceBadge.tone}
                                    dot
                                    className="shrink-0"
                                  >
                                    {sourceBadge.label}
                                  </StatusPill>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      turnCopyKey,
                                      buildCopyDigestText(res),
                                    )
                                  }
                                  title="Copiar resumen completo"
                                  aria-label="Copiar resumen de la respuesta"
                                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 cursor-pointer items-center justify-center transition-colors"
                                >
                                  {copiedKey === turnCopyKey ? (
                                    <Icons.Check className="text-status-success-fg size-3.5" />
                                  ) : (
                                    <Icons.Copy className="size-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {res.reply}
                            </p>
                          </div>

                          {/* Section 2: Hairline KPI Matrix (`gap-px bg-border`) */}
                          {res.kpis.length > 0 ? (
                            <div
                              className={cn(
                                "bg-border grid gap-px",
                                res.kpis.length === 1
                                  ? "grid-cols-1"
                                  : isExpandedWidth && res.kpis.length >= 3
                                    ? "grid-cols-2 sm:grid-cols-3"
                                    : "grid-cols-2",
                              )}
                            >
                              {res.kpis.map((kpi) => (
                                <div
                                  key={kpi.label}
                                  className="bg-card flex flex-col gap-0.5 px-3 py-2.5"
                                >
                                  <span className="text-muted-foreground text-xs">
                                    {kpi.label}
                                  </span>
                                  <span
                                    className={cn(
                                      "font-mono text-xs font-medium tabular-nums sm:text-sm",
                                      mapKpiToneToTextClass(kpi.tone),
                                    )}
                                  >
                                    {kpi.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {/* Section 3: Digested Dossier Fields with 1-Click Copy */}
                          {res.details.length > 0 ? (
                            <dl
                              className={cn(
                                "bg-border grid gap-px",
                                isExpandedWidth && res.details.length >= 4
                                  ? "grid-cols-1 sm:grid-cols-2"
                                  : "grid-cols-1",
                              )}
                            >
                              {res.details.map((field) => {
                                const fieldCopyKey = `${turn.id}:detail:${field.label}`;
                                return (
                                  <div
                                    key={field.label}
                                    className="bg-background group/detail flex items-start justify-between gap-2 px-3 py-2"
                                  >
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                      <dt className="text-muted-foreground text-xs font-medium">
                                        {field.label}
                                      </dt>
                                      <dd
                                        className={cn(
                                          "text-xs leading-snug break-words",
                                          field.mono &&
                                            "font-mono tabular-nums",
                                          mapKpiToneToTextClass(field.tone),
                                        )}
                                      >
                                        {field.value}
                                      </dd>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopyText(
                                          fieldCopyKey,
                                          field.value,
                                        )
                                      }
                                      title={`Copiar ${field.label}`}
                                      aria-label={`Copiar ${field.label}`}
                                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 shrink-0 cursor-pointer items-center justify-center transition-colors"
                                    >
                                      {copiedKey === fieldCopyKey ? (
                                        <Icons.Check className="text-status-success-fg size-3.5" />
                                      ) : (
                                        <Icons.Copy className="size-3.5" />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </dl>
                          ) : null}

                          {/* Section 4: Entity Result Rows with Domain Glyph */}
                          {res.items.length > 0 ? (
                            <div className="divide-border flex flex-col divide-y">
                              {res.items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleNavigate(item.href)}
                                  className="bg-surface hover:bg-row-hover group/row flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 px-3 py-2.5 text-left transition-colors"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {renderDomainRowIcon(res.intent)}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-foreground truncate text-xs font-medium">
                                        {item.title}
                                      </p>
                                      <p className="text-muted-foreground truncate text-xs">
                                        {item.subtitle}
                                      </p>
                                    </div>
                                  </div>
                                  {item.badgeText ? (
                                    <StatusPill
                                      tone={item.badgeTone ?? "neutral"}
                                      className="shrink-0 font-mono tabular-nums"
                                    >
                                      {item.badgeText}
                                    </StatusPill>
                                  ) : null}
                                  <Icons.ArrowOutward className="text-muted-foreground group-hover/row:text-foreground size-3.5 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {/* Section 5: 1-Click Quick Actions & Module Deep-Link */}
                          {res.quickActions.length > 0 || res.deepLink ? (
                            <div className="bg-card flex flex-wrap items-center gap-1.5 px-3 py-2.5">
                              {res.quickActions.map((act) => (
                                <button
                                  key={`${act.label}:${act.href}`}
                                  type="button"
                                  onClick={() => handleNavigate(act.href)}
                                  className={cn(
                                    "border-border inline-flex min-h-8 cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors",
                                    act.variant === "primary"
                                      ? "bg-primary text-primary-foreground hover:opacity-90"
                                      : "bg-background text-foreground hover:bg-accent",
                                  )}
                                >
                                  <span>{act.label}</span>
                                  <Icons.ArrowOutward className="size-3.5 shrink-0" />
                                </button>
                              ))}
                              {res.deepLink ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    res.deepLink &&
                                    handleNavigate(res.deepLink.href)
                                  }
                                  className="border-border bg-secondary hover:bg-accent text-secondary-foreground inline-flex min-h-8 cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors"
                                >
                                  <span>{res.deepLink.label}</span>
                                  <Icons.ArrowForward className="size-3.5 shrink-0" />
                                </button>
                              ) : null}
                              <span className="text-muted-foreground ml-auto font-mono text-xs tabular-nums">
                                {res.latencyMs} ms
                              </span>
                            </div>
                          ) : null}

                          {/* Section 6: Contextual Multi-Turn Follow-Ups (on latest turn) */}
                          {isLatest &&
                          !chatMutation.isPending &&
                          res.followUps.length > 0 ? (
                            <div className="bg-background flex flex-wrap gap-1.5 px-3 py-2.5">
                              {res.followUps.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => sendMessage(chip)}
                                  className="border-border bg-surface hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer border px-2.5 py-1 text-left text-xs transition-colors"
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ) : turn.errorText ? (
                        <div
                          role="alert"
                          className="border-border bg-status-destructive-bg text-status-destructive-fg flex items-center justify-between gap-3 border p-3 text-xs"
                        >
                          <span className="leading-snug">{turn.errorText}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleRetryTurn(turn.id, turn.userText)
                            }
                            className="border-border bg-background text-foreground hover:bg-accent inline-flex shrink-0 cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors"
                          >
                            <Icons.Refresh className="size-3.5" />
                            <span>Reintentar</span>
                          </button>
                        </div>
                      ) : (
                        /* Pending Skeleton Card with Kinetic Cendaro Brand Mark */
                        <div className="border-border bg-surface flex flex-col gap-3 border p-3.5">
                          <div className="flex items-center gap-2.5">
                            <CopilotCoreSvg
                              state="thinking"
                              size={18}
                              className="text-foreground"
                            />
                            <span className="text-foreground text-xs font-medium">
                              Verificando registros del workspace
                              <span className="loading-ellipsis" />
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="bg-muted h-3 w-4/5 animate-pulse" />
                            <div className="bg-muted h-3 w-3/5 animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(draft);
              }}
              className="border-border bg-card shrink-0 border-t p-3"
            >
              <div className="border-border bg-background focus-within:border-foreground flex items-end gap-2 border px-3 py-2 transition-colors">
                <textarea
                  ref={textareaRef}
                  id="cendaro-copilot-input"
                  name="copilot-message"
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 96)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(draft);
                    }
                  }}
                  placeholder="Pregunta por una factura, cliente, pago o stock..."
                  aria-label="Escribir consulta para Cendaro IA"
                  maxLength={320}
                  className="text-foreground placeholder:text-muted-foreground max-h-24 min-h-6 flex-1 resize-none bg-transparent text-base leading-relaxed outline-none md:text-xs"
                />
                <button
                  type="submit"
                  disabled={draft.trim().length < 2 || chatMutation.isPending}
                  aria-label="Enviar consulta"
                  className="bg-primary text-primary-foreground flex size-9 shrink-0 cursor-pointer items-center justify-center transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Icons.ArrowUpward className="size-4" />
                </button>
              </div>
              <div className="text-muted-foreground mt-2 flex items-center justify-between px-0.5 text-xs">
                <span>Enter enviar · Shift+Enter línea</span>
                <span className="font-mono">Ctrl+.</span>
              </div>
            </form>
          </m.section>
        ) : (
          /* Compact Architectural Cendaro Monogram Launcher (44x44 mobile, two-tone command badge desktop) */
          <m.button
            key="cendaro-copilot-launcher"
            type="button"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
            }
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: easeOutExpo }}
            onClick={() => setIsOpen(true)}
            onMouseEnter={() => setIsLauncherHovered(true)}
            onMouseLeave={() => setIsLauncherHovered(false)}
            aria-expanded={false}
            aria-label="Abrir asistente conversacional Cendaro IA (Ctrl + .)"
            className="border-border bg-card group flex h-11 cursor-pointer items-center border shadow-md transition-transform active:scale-[0.99]"
          >
            <span className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center">
              <CopilotCoreSvg state={launcherSvgState} size={22} />
            </span>
            <span className="border-border group-hover:bg-accent hidden h-full items-center gap-2.5 border-l px-3.5 transition-colors sm:flex">
              <span className="text-foreground text-xs font-medium tracking-tight">
                Cendaro IA
              </span>
              <kbd className="border-border bg-secondary text-muted-foreground border px-1.5 py-0.5 font-mono text-xs">
                Ctrl+.
              </kbd>
            </span>
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Floating bottom-right conversational AI Copilot mounted once in `AppShell`.
 * Keyed strictly by `(workspaceId, userId)` in React memory (zero browser storage PII).
 */
export function FloatingAiCopilot() {
  const { isReady, workspaceId } = useWorkspace();
  const { profile, roleLabel } = useCurrentUser();

  if (!isReady || !workspaceId || !profile) {
    return null;
  }

  return (
    <FloatingAiCopilotSession
      key={`${workspaceId}:${profile.id}`}
      fullName={profile.fullName}
      role={profile.role}
      roleLabel={roleLabel}
    />
  );
}
