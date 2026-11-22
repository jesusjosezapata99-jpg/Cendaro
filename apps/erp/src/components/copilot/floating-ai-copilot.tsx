"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";

import type { StatusTone } from "@cendaro/ui/status-pill";
import type {
  CopilotChatResponse,
  CopilotHistoryTurn,
  UserRole,
} from "@cendaro/validators";
import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";
import { can } from "@cendaro/validators";

import { useCurrentUser } from "~/hooks/use-current-user";
import { useWorkspace } from "~/hooks/use-workspace";
import { useTRPC } from "~/trpc/client";
import { CopilotCoreSvg } from "./copilot-core-svg";

const MAX_IN_MEMORY_TURNS = 20;
const MAX_HISTORY_CONTEXT = 6;

interface ConversationTurn {
  id: string;
  userText: string;
  createdAt: number;
  response?: CopilotChatResponse;
  errorText?: string;
}

interface StarterPrompt {
  id: string;
  label: string;
  prompt: string;
}

function buildStarterPrompts(role: UserRole): StarterPrompt[] {
  const starters: StarterPrompt[] = [
    {
      id: "pulse",
      label: "¿Cómo vamos hoy?",
      prompt: "¿Cómo vamos hoy?",
    },
  ];

  if (can(role, "orders", "read")) {
    starters.push({
      id: "last-invoice",
      label: "Última factura emitida",
      prompt: "¿Cuál fue la última factura emitida?",
    });
  }

  if (can(role, "payments", "read")) {
    starters.push({
      id: "today-payments",
      label: "Pagos registrados hoy",
      prompt: "¿Qué pagos entraron hoy?",
    });
  }

  if (can(role, "receivables", "read")) {
    starters.push({
      id: "overdue-ar",
      label: "Cuentas por cobrar vencidas",
      prompt: "¿Cuáles cuentas por cobrar están vencidas?",
    });
  } else if (can(role, "orders", "read")) {
    starters.push({
      id: "pending-dispatch",
      label: "Pedidos por despachar",
      prompt: "¿Qué pedidos faltan por despachar?",
    });
  }

  if (can(role, "inventory", "read")) {
    starters.push({
      id: "low-stock",
      label: "Productos con stock bajo",
      prompt: "¿Qué productos tienen stock bajo?",
    });
  }

  starters.push({
    id: "bcv-rate",
    label: "Tasa BCV y conversión",
    prompt: "¿A cómo está el dólar BCV hoy?",
  });

  return starters.slice(0, 5);
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
  const [isLauncherHovered, setIsLauncherHovered] = useState(false);
  const [draft, setDraft] = useState("");
  // Strictly in-memory React state inside AppShell: persists across SPA route
  // transitions while guaranteeing 0% cleartext PII / balances in Web Storage.
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const activeTurnIdRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = useMemo(() => {
    const token = fullName.trim().split(/\s+/)[0];
    return token && token.length > 0 ? token : "equipo";
  }, [fullName]);

  const isManagementView = can(role, "receivables", "read");
  const starterPrompts = useMemo(() => buildStarterPrompts(role), [role]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      threadEndRef.current?.scrollIntoView({ behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Global keyboard toggle: Ctrl+. / Cmd+.
  useEffect(() => {
    function onWindowKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

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

  function handleResetConversation() {
    if (chatMutation.isPending) return;
    setTurns([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleNavigate(href: string) {
    if (href.startsWith("?")) {
      router.push(`${pathname}${href}`);
      return;
    }
    router.push(href);
  }

  const svgVisualState = chatMutation.isPending
    ? "thinking"
    : isOpen
      ? "open"
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
      className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3"
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen) {
          e.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      <AnimatePresence>
        {isOpen ? (
          <m.section
            key="copilot-panel"
            role="dialog"
            aria-modal="false"
            aria-label="Asistente conversacional Cendaro"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, scale: 0.98 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.98 }
            }
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="border-border bg-background flex h-[min(600px,calc(100dvh-6.5rem))] w-[min(420px,calc(100vw-2rem))] flex-col border shadow-md"
          >
            {/* Header */}
            <header className="border-border bg-card flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="border-border bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center border">
                  <CopilotCoreSvg
                    state={chatMutation.isPending ? "thinking" : "idle"}
                    size={22}
                    innerCutoutColor="var(--primary)"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground truncate text-sm font-medium">
                      Asistente Cendaro
                    </h2>
                    <StatusPill tone="neutral" className="shrink-0">
                      {roleLabel}
                    </StatusPill>
                  </div>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {chatMutation.isPending
                      ? "Analizando datos operativos..."
                      : "Consultas naturales · Datos protegidos"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {turns.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleResetConversation}
                    disabled={chatMutation.isPending}
                    title="Nueva conversación"
                    aria-label="Iniciar nueva conversación"
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center transition-colors disabled:opacity-40"
                  >
                    <Icons.Refresh className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Minimizar asistente (ESC)"
                  aria-label="Minimizar asistente"
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center transition-colors"
                >
                  <Icons.Close className="size-4" />
                </button>
              </div>
            </header>

            {/* Conversation Stream */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="border-border bg-card flex flex-col gap-2 border p-3.5">
                    <p className="text-foreground text-sm font-medium">
                      Hola, {firstName}. ¿Qué revisamos ahora?
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {isManagementView
                        ? "Pregúntame con lenguaje normal cuál fue la última factura de una empresa, cómo y cuándo pagó, cuentas vencidas, cierres de caja, stock por almacén o contenedores."
                        : "Pregúntame con normalidad cuál fue la última factura o pedido de un cliente, cómo pagó, precios en USD y Bs. (BCV), disponibilidad de stock o tus cotizaciones."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Sugerencias para tu rol
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {starterPrompts.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => sendMessage(item.prompt)}
                          className="border-border bg-surface hover:bg-accent group flex items-center justify-between gap-2 border px-3 py-2.5 text-left text-xs transition-colors"
                        >
                          <span className="text-foreground font-medium">
                            {item.prompt}
                          </span>
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

                  return (
                    <div key={turn.id} className="flex flex-col gap-2.5">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground max-w-[85%] px-3.5 py-2 text-xs leading-relaxed">
                          {turn.userText}
                        </div>
                      </div>

                      {/* Assistant Turn */}
                      {res ? (
                        <div className="border-border bg-card flex flex-col gap-3 border p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-foreground text-xs font-medium">
                              {res.headline}
                            </span>
                            {sourceBadge ? (
                              <StatusPill
                                tone={sourceBadge.tone}
                                className="shrink-0"
                              >
                                {sourceBadge.label}
                              </StatusPill>
                            ) : null}
                          </div>

                          <p className="text-muted-foreground text-xs leading-relaxed">
                            {res.reply}
                          </p>

                          {/* Digested Dossier Details (Invoice # / Control SENIAT / Payment Method / Items) */}
                          {res.details.length > 0 ? (
                            <dl className="border-border divide-border bg-background flex flex-col divide-y border">
                              {res.details.map((field) => (
                                <div
                                  key={field.label}
                                  className="flex flex-col gap-0.5 px-3 py-2"
                                >
                                  <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                                    {field.label}
                                  </dt>
                                  <dd
                                    className={cn(
                                      "text-xs leading-snug break-words",
                                      field.mono && "font-mono tabular-nums",
                                      mapKpiToneToTextClass(field.tone),
                                    )}
                                  >
                                    {field.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}

                          {/* 1-Click Interactive Slide-Over & Module Actions */}
                          {res.quickActions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {res.quickActions.map((act) => (
                                <button
                                  key={`${act.label}:${act.href}`}
                                  type="button"
                                  onClick={() => handleNavigate(act.href)}
                                  className={cn(
                                    "border-border inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                                    act.variant === "primary"
                                      ? "bg-primary text-primary-foreground hover:opacity-90"
                                      : "bg-secondary text-foreground hover:bg-accent",
                                  )}
                                >
                                  <span>{act.label}</span>
                                  <Icons.ArrowOutward className="size-3 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {/* KPI Strip */}
                          {res.kpis.length > 0 ? (
                            <div
                              className={cn(
                                "grid gap-2",
                                res.kpis.length === 1
                                  ? "grid-cols-1"
                                  : "grid-cols-2",
                              )}
                            >
                              {res.kpis.map((kpi) => (
                                <div
                                  key={kpi.label}
                                  className="border-border bg-background flex flex-col gap-0.5 border px-2.5 py-2"
                                >
                                  <span className="text-muted-foreground text-[11px]">
                                    {kpi.label}
                                  </span>
                                  <span
                                    className={cn(
                                      "font-mono text-xs font-medium tabular-nums",
                                      mapKpiToneToTextClass(kpi.tone),
                                    )}
                                  >
                                    {kpi.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {/* Entity Action Rows */}
                          {res.items.length > 0 ? (
                            <div className="border-border divide-border flex flex-col divide-y border">
                              {res.items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleNavigate(item.href)}
                                  className="bg-background hover:bg-accent group/row flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-foreground truncate text-xs font-medium">
                                      {item.title}
                                    </p>
                                    <p className="text-muted-foreground truncate text-[11px]">
                                      {item.subtitle}
                                    </p>
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

                          {/* Deep-Link CTA */}
                          {res.deepLink ? (
                            <button
                              type="button"
                              onClick={() =>
                                res.deepLink &&
                                handleNavigate(res.deepLink.href)
                              }
                              className="border-border bg-secondary hover:bg-accent text-foreground flex w-full items-center justify-between border px-3 py-2 text-xs font-medium transition-colors"
                            >
                              <span>{res.deepLink.label}</span>
                              <Icons.ArrowForward className="size-3.5 shrink-0" />
                            </button>
                          ) : null}

                          {/* Contextual Multi-Turn Follow-Ups (on latest turn) */}
                          {isLatest &&
                          !chatMutation.isPending &&
                          res.followUps.length > 0 ? (
                            <div className="border-border flex flex-wrap gap-1.5 border-t pt-2.5">
                              {res.followUps.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => sendMessage(chip)}
                                  className="border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground border px-2.5 py-1 text-left text-[11px] transition-colors"
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : turn.errorText ? (
                        <div className="border-border bg-status-destructive-bg text-status-destructive-fg border p-3 text-xs">
                          {turn.errorText}
                        </div>
                      ) : (
                        <div className="border-border bg-card flex items-center gap-3 border p-3.5">
                          <CopilotCoreSvg
                            state="thinking"
                            size={20}
                            innerCutoutColor="var(--card)"
                            className="text-foreground"
                          />
                          <span className="text-muted-foreground text-xs">
                            Consultando en tiempo real...
                          </span>
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
                  placeholder="Escribe una pregunta normal (ej. ¿cómo vamos hoy?)..."
                  aria-label="Escribir consulta para el asistente Cendaro"
                  maxLength={320}
                  className="text-foreground placeholder:text-muted-foreground max-h-24 min-h-6 flex-1 resize-none bg-transparent text-xs leading-relaxed outline-none"
                />
                <button
                  type="submit"
                  disabled={draft.trim().length < 2 || chatMutation.isPending}
                  aria-label="Enviar consulta"
                  className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center transition-opacity disabled:opacity-30"
                >
                  <Icons.ArrowUpward className="size-4" />
                </button>
              </div>
              <div className="text-muted-foreground/70 mt-1.5 flex items-center justify-between px-0.5 text-[10px]">
                <span>Enter enviar · Shift+Enter línea</span>
                <span className="font-mono">Ctrl + .</span>
              </div>
            </form>
          </m.section>
        ) : null}
      </AnimatePresence>

      {/* Bottom-Right Dynamic SVG Floating Launcher */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => setIsLauncherHovered(true)}
        onMouseLeave={() => setIsLauncherHovered(false)}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? "Cerrar asistente conversacional"
            : "Abrir asistente conversacional Cendaro (Ctrl + .)"
        }
        className={cn(
          "border-border bg-primary text-primary-foreground group flex min-h-12 items-center gap-2.5 border px-3.5 py-2 shadow-md transition-transform active:scale-[0.99]",
          isOpen ? "px-3" : "pr-4",
        )}
      >
        <CopilotCoreSvg
          state={svgVisualState}
          size={26}
          innerCutoutColor="var(--primary)"
        />
        {isOpen ? (
          <span className="text-xs font-medium tracking-wide">Cerrar</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-wide">
              Asistente IA
            </span>
            <kbd className="border-primary-foreground/25 text-primary-foreground/80 hidden border px-1 py-0.5 font-mono text-[10px] sm:inline-block">
              Ctrl+.
            </kbd>
          </div>
        )}
      </button>
    </div>
  );
}

/**
 * Floating bottom-right conversational AI Copilot mounted once in `AppShell`.
 * Keyed strictly by `(workspaceId, userId)` in React memory (zero Web Storage PII).
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
