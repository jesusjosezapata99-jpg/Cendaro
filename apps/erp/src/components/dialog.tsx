"use client";

import { useCallback, useEffect, useRef } from "react";

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
 * Accessible modal dialog built on the HTML `<dialog>` element.
 * Supports Escape key, backdrop click, and focus trapping out-of-box.
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
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
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={` ${className} border-border bg-card text-foreground open:animate-in open:fade-in-0 open:zoom-in-95 m-auto w-full rounded-2xl border p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
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
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        {children}
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

const inputBase =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";

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
    <div className="mt-6 flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="border-border text-muted-foreground hover:bg-secondary rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50"
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
