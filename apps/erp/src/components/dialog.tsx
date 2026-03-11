"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@cendaro/ui";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Max width class — defaults to max-w-lg */
  className?: string;
}

/**
 * Accessible modal dialog — mobile-first.
 *
 * - Mobile (< md): Full-screen bottom sheet with slide-up animation
 * - Desktop (md+): Centered modal with zoom-in animation
 *
 * Supports Escape key, backdrop click, focus trapping, and
 * iOS body scroll lock.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className = "max-w-lg",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const scrollYRef = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Save scroll position before locking body
      scrollYRef.current = window.scrollY;
      dialog.showModal();
      document.documentElement.classList.add("dialog-open");
      document.body.style.top = `-${scrollYRef.current}px`;
    } else if (!open && dialog.open) {
      dialog.close();
      document.documentElement.classList.remove("dialog-open");
      document.body.style.top = "";
      // Restore scroll position
      window.scrollTo(0, scrollYRef.current);
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("dialog-open");
      document.body.style.top = "";
    };
  }, []);

  const handleClose = useCallback(() => {
    document.documentElement.classList.remove("dialog-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollYRef.current);
    onClose();
  }, [onClose]);

  /* Handle native dialog close event (Escape key, backdrop click) */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [handleClose]);

  /* Backdrop click */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) handleClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        /* Base — shared */
        "border-border bg-card text-foreground w-full p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        /* Mobile: full-screen bottom sheet */
        "fixed inset-0 m-0 max-h-dvh max-w-none rounded-none border-0",
        "open:animate-in open:slide-in-from-bottom open:duration-300",
        /* Desktop: centered modal */
        "md:m-auto md:max-h-[85dvh] md:max-w-lg md:rounded-2xl md:border",
        "md:open:slide-in-from-bottom-0 md:open:fade-in-0 md:open:zoom-in-95",
        className,
      )}
    >
      {/* Inner wrapper with safe-area + scroll */}
      <div className="safe-pt safe-pb flex max-h-dvh flex-col md:max-h-[85dvh]">
        {/* Header — sticky */}
        <div className="border-border flex shrink-0 items-start justify-between border-b p-4 md:p-6">
          <div>
            <h2 className="text-foreground text-lg font-bold tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {description}
              </p>
            )}
          </div>
          {/* Close — 44px touch target */}
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-11 items-center justify-center rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          {children}
        </div>
      </div>
    </dialog>
  );
}

/* ────────────────────────────────────────────── */
/*  Reusable form field components               */
/* ────────────────────────────────────────────── */

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, required, children, hint, error }: FieldProps) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="text-muted-foreground mt-0.5 block text-[10px]">
          {hint}
        </span>
      )}
      {error && (
        <span className="text-destructive mt-0.5 block text-[10px]">
          {error}
        </span>
      )}
    </label>
  );
}

/* 44px min touch target on all inputs */
const inputBase =
  "w-full min-h-[44px] rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${inputBase} ${props.className ?? ""}`} />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${inputBase} resize-none ${props.className ?? ""}`}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode;
  },
) {
  return (
    <select {...props} className={`${inputBase} ${props.className ?? ""}`} />
  );
}

export function FormActions({
  onCancel,
  submitting,
  submitLabel = "Crear",
}: {
  onCancel: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="border-border text-muted-foreground hover:bg-secondary min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
      >
        {submitting && (
          <span className="material-symbols-outlined animate-spin text-sm">
            progress_activity
          </span>
        )}
        {submitLabel}
      </button>
    </div>
  );
}
