/**
 * Cendaro — Venezuelan fiscal data of an invoice buyer (SENIAT).
 *
 * Providencia SNAT/2011/00071 (art. 13, num. 7) and Providencia
 * SNAT/2024/000102 (Gaceta Oficial 43.032, art. 7, num. 7) require every
 * invoice to carry the buyer's:
 *   • nombre y apellido o razón social,
 *   • Registro Único de Información Fiscal (RIF), and
 *   • domicilio fiscal.
 * The RIF may be omitted only for natural persons who do not need the invoice
 * for tax purposes; the cédula de identidad or passport number is then the
 * minimum. Verified against both texts on 2026-09-17 (the 2026 RIF reform,
 * SNAT/2026/00080, did not change invoice data).
 *
 * Identifications are stored in one canonical form so they can be searched
 * and kept unique per workspace:
 *   RIF        J-12345678-9   (V, E, J, P, G, C)
 *   Cédula     V-12345678     (V, E)
 *   Pasaporte  PAS-AB123456
 */
import { z } from "zod/v4";

export const FISCAL_ID_TYPES = ["rif", "cedula", "pasaporte"] as const;
export type FiscalIdType = (typeof FISCAL_ID_TYPES)[number];

export const FISCAL_ID_TYPE_LABELS: Record<FiscalIdType, string> = {
  rif: "RIF",
  cedula: "Cédula de identidad",
  pasaporte: "Pasaporte",
};

/** Customer types — must match the `customer_type` enum in the DB schema. */
export const CUSTOMER_TYPES = [
  "wholesale",
  "retail",
  "distributor",
  "vip",
  "marketplace",
  "vendor_client",
] as const;

const RIF_PREFIXES = ["V", "E", "J", "P", "G", "C"] as const;

/**
 * Values of the RIF type letter in the SENIAT check-digit algorithm. "C"
 * (consejos comunales) has no published value, so its check digit is not
 * verified — only its format.
 */
const RIF_LETTER_VALUE: Readonly<Record<string, number>> = {
  V: 1,
  E: 2,
  J: 3,
  P: 4,
  G: 5,
};

const RIF_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

const PASSPORT_PREFIX = "PAS-";
const FISCAL_ADDRESS_MIN = 10;

/**
 * SENIAT RIF check digit (module 11): letter value × 4 plus each of the 8
 * digits × 3,2,7,6,5,4,3,2; the digit is 11 − (sum mod 11), and 10 or 11
 * become 0. Returns null for letters without a published value.
 */
export function rifCheckDigit(letter: string, digits: string): number | null {
  const letterValue = RIF_LETTER_VALUE[letter];
  if (letterValue === undefined || !/^\d{8}$/.test(digits)) return null;

  let sum = letterValue * 4;
  for (let i = 0; i < RIF_WEIGHTS.length; i++) {
    sum += Number(digits[i]) * (RIF_WEIGHTS[i] ?? 0);
  }
  const digit = 11 - (sum % 11);
  return digit >= 10 ? 0 : digit;
}

export type FiscalIdResult =
  { ok: true; value: string } | { ok: false; message: string };

function compact(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeRif(raw: string): FiscalIdResult {
  const value = compact(raw);
  const match = /^([A-Z])(\d{9})$/.exec(value);
  if (!match) {
    return {
      ok: false,
      message:
        "El RIF debe tener una letra (V, E, J, P, G o C), 8 dígitos y el dígito verificador (ej: J-12345678-9)",
    };
  }
  const [, letter = "", numbers = ""] = match;
  if (!(RIF_PREFIXES as readonly string[]).includes(letter)) {
    return {
      ok: false,
      message: "El RIF debe comenzar con V, E, J, P, G o C",
    };
  }
  const digits = numbers.slice(0, 8);
  const check = Number(numbers.slice(8));
  const expected = rifCheckDigit(letter, digits);
  if (expected !== null && expected !== check) {
    return {
      ok: false,
      message: "El dígito verificador del RIF no es válido. Revisa el número",
    };
  }
  return { ok: true, value: `${letter}-${digits}-${check}` };
}

function normalizeCedula(raw: string): FiscalIdResult {
  const match = /^([VE])(\d{5,9})$/.exec(compact(raw));
  if (!match) {
    return {
      ok: false,
      message:
        "La cédula debe tener V o E y entre 5 y 9 dígitos (ej: V-12345678)",
    };
  }
  const [, letter = "", digits = ""] = match;
  // Leading zeros are dropped, so the remaining number must still have 5.
  const number = String(Number(digits));
  if (number.length < 5) {
    return {
      ok: false,
      message:
        "La cédula debe tener V o E y entre 5 y 9 dígitos (ej: V-12345678)",
    };
  }
  return { ok: true, value: `${letter}-${number}` };
}

function normalizePassport(raw: string): FiscalIdResult {
  const value = compact(raw).replace(/^PAS/, "");
  if (!/^[A-Z0-9]{5,20}$/.test(value)) {
    return {
      ok: false,
      message: "El pasaporte debe tener entre 5 y 20 letras o números",
    };
  }
  return { ok: true, value: `${PASSPORT_PREFIX}${value}` };
}

/** Validates an identification and returns its canonical stored form. */
export function normalizeFiscalId(
  type: FiscalIdType,
  raw: string,
): FiscalIdResult {
  switch (type) {
    case "rif":
      return normalizeRif(raw);
    case "cedula":
      return normalizeCedula(raw);
    case "pasaporte":
      return normalizePassport(raw);
  }
}

/**
 * Key that identifies the person behind a canonical identification. A
 * Venezuelan or foreign resident's personal RIF is their cédula padded to 8
 * digits plus a check digit (V-12345678 ⇄ V-12345678-X), so both map to the
 * cédula form; every other identification is its own key.
 *
 * Mirrors the `customer.person_key` generated column (migration 014,
 * CUSTOMER_PERSON_KEY_SQL in @cendaro/db/schema), whose unique index is what
 * actually prevents registering the same person twice.
 */
export function fiscalPersonKey(identification: string): string {
  const rif = /^([VE])-(\d{8})-\d$/.exec(identification);
  if (!rif) return identification;
  const [, letter = "", digits = ""] = rif;
  if (digits === "00000000") return identification;
  return `${letter}-${digits.replace(/^0+/, "")}`;
}

/** Detects the type of an identification already stored in canonical form. */
export function fiscalIdTypeOf(
  identification: string | null | undefined,
): FiscalIdType | null {
  if (!identification) return null;
  if (identification.startsWith(PASSPORT_PREFIX)) {
    return normalizePassport(identification).ok ? "pasaporte" : null;
  }
  if (/^[VEJPGC]-\d{8}-\d$/.test(identification)) {
    return normalizeRif(identification).ok ? "rif" : null;
  }
  if (/^[VE]-\d{5,9}$/.test(identification)) return "cedula";
  return null;
}

/**
 * True when the stored customer data meets SENIAT's buyer requirements:
 * a name, a valid RIF / cédula / passport, and the domicilio fiscal.
 */
export function isFiscalInvoiceReady(customer: {
  name?: string | null;
  identification?: string | null;
  address?: string | null;
}): boolean {
  return (
    (customer.name?.trim().length ?? 0) >= 2 &&
    fiscalIdTypeOf(customer.identification) !== null &&
    (customer.address?.trim().length ?? 0) >= FISCAL_ADDRESS_MIN
  );
}

/** Blank optional text is accepted so a form can clear a stored value. */
const optionalEmail = z.union([z.email(), z.literal("")]).optional();

/**
 * Customer fields shared by the form, `sales.createCustomer` and
 * `sales.updateCustomer`. `identification` is validated for its type; the
 * server stores the canonical value returned by `normalizeFiscalId`.
 */
const customerFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indica el nombre y apellido o la razón social")
    .max(256),
  legalName: z.string().trim().max(512).optional(),
  idType: z.enum(FISCAL_ID_TYPES),
  identification: z
    .string()
    .trim()
    .min(1, "El documento de identificación es obligatorio")
    .max(32),
  address: z
    .string()
    .trim()
    .min(
      FISCAL_ADDRESS_MIN,
      "El domicilio fiscal es obligatorio para la factura (mínimo 10 caracteres)",
    )
    .max(512),
  customerType: z.enum(CUSTOMER_TYPES).default("retail"),
  phone: z.string().trim().max(32).optional(),
  email: optionalEmail,
  creditLimit: z.number().nonnegative().optional(),
  creditDays: z.number().int().nonnegative().optional(),
});

function refineFiscalId(
  input: { idType: FiscalIdType; identification: string },
  ctx: z.RefinementCtx,
): void {
  const result = normalizeFiscalId(input.idType, input.identification);
  if (!result.ok) {
    ctx.addIssue({
      code: "custom",
      path: ["identification"],
      message: result.message,
    });
  }
}

export const createCustomerSchema =
  customerFieldsSchema.superRefine(refineFiscalId);

export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

/**
 * Update-customer input: the same fiscal requirements as creation, so a
 * customer with incomplete data (legacy or seed rows) can only be saved once
 * it is invoice-ready. Omitted credit fields keep their stored value; the
 * customer type is required so an omission cannot reset it to "retail".
 */
export const updateCustomerSchema = customerFieldsSchema
  .extend({ id: z.uuid(), customerType: z.enum(CUSTOMER_TYPES) })
  .superRefine(refineFiscalId);

export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;
