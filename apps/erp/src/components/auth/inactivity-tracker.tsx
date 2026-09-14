"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { Dialog } from "~/components/dialog";

interface InactivityTrackerProps {
  /** Total minutes of inactivity before automatic logout. Default: 15 (SOC 2 / ISO 27001 standard) */
  timeoutMinutes?: number;
  /** Minutes before timeout to show the expiration warning modal. Default: 2 */
  warningMinutes?: number;
}

const THROTTLE_MS = 10_000; // Only process user interaction events once every 10 seconds (0% CPU impact)

export function InactivityTracker({
  timeoutMinutes = 15,
  warningMinutes = 2,
}: InactivityTrackerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningMinutes * 60);

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningMinutes * 60 * 1000;
  const warningThresholdMs = timeoutMs - warningMs;

  const lastActivityRef = useRef<number>(Date.now());
  const lastEventProcessedRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Best-effort logout network call
    } finally {
      window.location.href = "/login?reason=inactivity";
    }
  }, []);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsRemaining(warningMinutes * 60);
  }, [warningMinutes]);

  // Event listener with passive throttling
  useEffect(() => {
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastEventProcessedRef.current >= THROTTLE_MS) {
        lastEventProcessedRef.current = now;
        // Only bump lastActivity if we are NOT currently in the modal warning state
        // (if warning is showing, user must explicitly click the button to continue)
        if (!showWarning) {
          lastActivityRef.current = now;
        }
      }
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    for (const evt of events) {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    }

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, handleUserActivity);
      }
    };
  }, [showWarning]);

  // Timer check loop (runs every 1 second)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const idleDuration = Date.now() - lastActivityRef.current;

      if (idleDuration >= timeoutMs) {
        void handleLogout();
      } else if (idleDuration >= warningThresholdMs) {
        const remaining = Math.max(
          0,
          Math.ceil((timeoutMs - idleDuration) / 1000),
        );
        setShowWarning(true);
        setSecondsRemaining(remaining);
      } else if (showWarning) {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeoutMs, warningThresholdMs, showWarning, handleLogout]);

  return (
    <Dialog
      open={showWarning}
      onClose={() => {
        // Prevent accidental closing by clicking overlay — force explicit decision
      }}
      title="Sesión por expirar por inactividad"
      description="Control de Seguridad Enterprise (SOC 2 / ISO 27001)"
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="border-warning-fg/20 bg-warning-bg/10 flex items-start gap-3 border p-3 text-sm text-[--status-warning-fg]">
          <Icons.Warning className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">
              Tu sesión se cerrará en{" "}
              <span className="font-mono font-medium text-[--status-warning-fg]">
                {Math.floor(secondsRemaining / 60)}:
                {String(secondsRemaining % 60).padStart(2, "0")}
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Para proteger los datos confidenciales de la empresa en terminales
              desatendidos, el sistema cierra la sesión automáticamente.
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleLogout()}
            className="text-xs"
          >
            Cerrar sesión ahora
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={resetActivity}
            className="text-xs font-medium"
          >
            Mantener sesión activa
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
