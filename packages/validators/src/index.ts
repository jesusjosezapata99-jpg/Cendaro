/**
 * Cendaro — Shared Validators
 *
 * Domain validation schemas shared between frontend and backend.
 * These are used by both tRPC procedures and React Hook Form.
 */
import { z } from "zod/v4";

// ──────────────────────────────────────────────
// Common primitives
// ──────────────────────────────────────────────

/** Venezuelan RIF format: J-12345678-9 or similar */
export const rifSchema = z
  .string()
  .regex(
    /^[JVGEP]-\d{8}-\d$/,
    "RIF debe tener formato válido (ej: J-12345678-9)",
  );

/** Venezuelan Cédula: V-12345678 */
export const cedulaSchema = z
  .string()
  .regex(/^[VE]-\d{6,8}$/, "Cédula debe tener formato válido (ej: V-1234567)");

/** Positive monetary amount */
export const moneySchema = z
  .number()
  .nonnegative("El monto no puede ser negativo")
  .multipleOf(0.01, "El monto debe tener máximo 2 decimales");

/** Exchange rate (positive, up to 4 decimals) */
export const exchangeRateSchema = z
  .number()
  .positive("La tasa debe ser positiva")
  .multipleOf(0.0001, "La tasa debe tener máximo 4 decimales");

/** Percentage (0–100) */
export const percentageSchema = z
  .number()
  .min(0, "Mínimo 0%")
  .max(100, "Máximo 100%");

/** SKU internal code */
export const skuCodeSchema = z
  .string()
  .min(1, "Código interno requerido")
  .max(64, "Máximo 64 caracteres");

/** Barcode */
export const barcodeSchema = z
  .string()
  .max(128, "Código de barras demasiado largo")
  .optional();
