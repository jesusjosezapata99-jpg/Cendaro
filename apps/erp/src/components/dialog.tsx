"use client";

import { Button, Label, Input as UiInput } from "@cendaro/ui";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  Dialog as DialogPrimitive,
  DialogTitle,
} from "@cendaro/ui/dialog";
import { SubmitButton } from "@cendaro/ui/submit-button";
import { Textarea as UiTextarea } from "@cendaro/ui/textarea";

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
 * Accessible modal dialog — mobile-first, built on `@cendaro/ui/dialog`
 * (Radix). Same call-site API as before this migration (T1.8): `open`,
 * `onClose`, `title`, `description`, `children`, `className`.
 *
 * - Mobile (< md): bottom sheet (native to `@cendaro/ui/dialog`'s
 *   `DialogContent`, no extra markup needed here).
 * - Desktop (md+): centered modal, M-13 fade/scale.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className = "max-w-lg",
}: DialogProps) {
  return (
    <DialogPrimitive
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={`flex max-h-[85dvh] flex-col overflow-hidden p-0 ${className}`}
      >
        <DialogHeader className="border-border shrink-0 border-b p-4 md:p-6">
          <DialogTitle className="mb-0">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          {children}
        </div>
      </DialogContent>
    </DialogPrimitive>
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
      <Label className="mb-1 text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <UiInput {...props} className={`min-h-11 ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <UiTextarea {...props} />;
}

/* Native <select> — kept HTML-native (not the Radix @cendaro/ui/select
 * compound API) because 26 call sites pass plain <option> children;
 * migrating to Radix's Select/SelectItem shape is a separate, call-site-level
 * task (deferred to F4's forms pass). Restyled to match the new tokens. */
const selectBase =
  "border-input focus-visible:border-ring w-full min-h-11 border bg-transparent px-3 py-2.5 text-sm outline-none disabled:opacity-50";

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode;
  },
) {
  return (
    <select {...props} className={`${selectBase} ${props.className ?? ""}`} />
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
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="min-h-11"
      >
        Cancelar
      </Button>
      <SubmitButton type="submit" loading={submitting} className="min-h-11">
        {submitLabel}
      </SubmitButton>
    </div>
  );
}
