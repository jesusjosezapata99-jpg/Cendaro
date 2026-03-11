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

/** Venezuelan phone number: +58-XXX-XXXXXXX or 0XXX-XXXXXXX */
export const phoneSchema = z
  .string()
  .regex(
    /^(\+58|0)\d{3}-?\d{7}$/,
    "Teléfono debe tener formato VE válido (ej: 0414-1234567)",
  );

/** Order number: ORD-XXXXXXXX */
export const orderNumberSchema = z
  .string()
  .regex(/^ORD-[A-Z0-9]{4,16}$/, "Número de orden inválido (ej: ORD-A1B2C3D4)");

/** Container number format */
export const containerNumberSchema = z
  .string()
  .min(4, "Número de contenedor muy corto")
  .max(64, "Número de contenedor muy largo");

// ──────────────────────────────────────────────
// RBAC — Single source of truth for user roles
// ──────────────────────────────────────────────

/** All user roles — must match the `user_role` enum in the DB schema */
export const USER_ROLES = [
  "owner",
  "admin",
  "supervisor",
  "employee",
  "vendor",
  "marketing",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);

// ──────────────────────────────────────────────
// Composite form schemas (frontend ↔ backend)
// ──────────────────────────────────────────────

/** Create order form schema */
export const createOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  channel: z.enum([
    "store",
    "mercadolibre",
    "vendors",
    "whatsapp",
    "instagram",
  ]),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: moneySchema,
        discount: percentageSchema.optional(),
      }),
    )
    .min(1, "Se requiere al menos un producto"),
  notes: z.string().optional(),
});

/** Create quote form schema */
export const createQuoteSchema = z.object({
  customerId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: moneySchema,
        discount: percentageSchema.optional(),
      }),
    )
    .min(1, "Se requiere al menos un producto"),
  notes: z.string().optional(),
});

/** Payment form schema */
export const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum([
    "mobile_payment",
    "transfer",
    "cash",
    "pos_terminal",
    "zelle",
  ]),
  amount: moneySchema,
  reference: z.string().max(128).optional(),
  bankName: z.string().max(128).optional(),
  payerName: z.string().max(256).optional(),
  payerIdDoc: z.string().max(32).optional(),
  notes: z.string().optional(),
});
