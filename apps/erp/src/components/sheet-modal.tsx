"use client";

import React from "react";

import { Button, cn } from "@cendaro/ui";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  Sheet as SheetPrimitive,
  SheetTitle,
} from "@cendaro/ui/sheet";
import { SubmitButton } from "@cendaro/ui/submit-button";

interface SheetModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Custom max-width class — defaults to sm:max-w-xl md:max-w-2xl */
  className?: string;
  maxWidth?: string;
  side?: "right" | "left";
}

/**
 * Cendaro Sheet Modal (PLAN-2026-09-DESIGN-SYSTEM §T5.2).
 *
 * Replaces Dialog for create/edit forms:
 * - Header: text-xl title, optional description, close button
 * - Content: scrollable body + sticky bottom footer
 * - Mobile (< md): 100% full width with safe-pb
 * - Desktop: right drawer with 0-radius monochrome styling
 */
export function SheetModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth,
  side = "right",
}: SheetModalProps) {
  return (
    <SheetPrimitive
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side={side}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-xl md:max-w-2xl",
          maxWidth ?? className,
        )}
      >
        <SheetHeader className="border-border shrink-0 border-b p-6 pr-12 pb-4">
          <SheetTitle className="text-xl font-medium">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-muted-foreground mt-1 text-xs">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </SheetContent>
    </SheetPrimitive>
  );
}

/**
 * Reusable scrollable container for form fields inside a SheetModal.
 */
export function SheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 space-y-4 overflow-y-auto overscroll-contain p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Reusable sticky bottom footer container for SheetModal actions.
 */
export function SheetFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-background safe-pb shrink-0 border-t p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Standard form actions for sheets: Cancel (outline) + Primary Submit.
 */
export function SheetFormActions({
  onCancel,
  submitting,
  submitLabel = "Crear",
  disabled,
}: {
  onCancel: () => void;
  submitting: boolean;
  submitLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={submitting}
        className="min-h-11"
      >
        Cancelar
      </Button>
      <SubmitButton
        type="submit"
        loading={submitting}
        disabled={disabled}
        className="min-h-11"
      >
        {submitLabel}
      </SubmitButton>
    </div>
  );
}
