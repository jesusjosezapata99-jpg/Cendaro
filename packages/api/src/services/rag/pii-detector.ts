/**
 * Cendaro — Multi-Jurisdiction PII & Fiscal Entity Detection Engine
 *
 * Implements high-precision pattern recognition for multi-national fiscal IDs,
 * banking coordinates, credit card PANs (with Luhn check), and confidential commercial costs.
 * Closes V-13 (unhyphenated, spaced, and dotted SENIAT RIF omissions).
 */

export type PiiEntityType =
  | "rif_ve"
  | "rif"
  | "nif_cif_es"
  | "rfc_mx"
  | "ein_us"
  | "iban"
  | "swift_bic"
  | "card_pan"
  | "fob_cost"
  | "fob_price"
  | "commercial_margin";

export interface DetectedPii {
  type: PiiEntityType;
  raw: string;
  normalized: string;
  start: number;
  end: number;
}

/**
 * Validates a candidate card PAN string using the Luhn checksum algorithm (Mod 10).
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    const char = digits.charAt(i);
    let digit = Number.parseInt(char, 10);
    if (Number.isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Validates both Luhn Mod-10 checksum AND ISO/IEC 7812 payment-card IIN/MII prefix ranges,
 * preventing 13-digit GS1 EAN-13 product barcodes (e.g. China `690...`, Venezuela `759...`)
 * and 14-digit GTIN-14 shipping carton codes from false-positiving as credit card PANs.
 */
export function isPaymentCardPan(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (!validateLuhn(digits)) {
    return false;
  }
  const len = digits.length;
  if (len === 13) {
    // 13-digit payment cards are strictly legacy Visa (4...)
    return digits.startsWith("4");
  }
  if (len === 14) {
    // 14-digit payment cards are Diners Club / Carte Blanche (300-305, 36, 38, 39)
    return /^(?:30[0-5]|36|38|39)/.test(digits);
  }
  if (len === 15) {
    // 15-digit payment cards are Amex (34, 37) or JCB (2131, 1800)
    return /^(?:34|37|2131|1800)/.test(digits);
  }
  // 16..19-digit payment cards use MII 3, 4, 5, 6 or Mastercard 2-series (2221-2720)
  return /^(?:[3456]|2(?:22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720))/.test(
    digits,
  );
}

/**
 * Multi-jurisdiction PII regex patterns.
 */
export const PII_PATTERNS = {
  // Venezuela SENIAT RIF (hyphenated, unhyphenated, spaced, dotted — zero adjacent optional quantifiers)
  RIF_VE: /\b([JVGEPCjvgepc])\s*(?:[-.]\s*)?(\d{7,9})\s*(?:[-.]\s*)?(\d)\b/g,

  // Venezuela Cédula de Identidad (6-8 digits with separator V-1234567 / E-654321, or 7-8 digits compact V1234567)
  CEDULA_VE: /\b([VEve])\s*[-.]\s*(\d{6,8})\b|\b([VEve])(\d{7,8})\b/g,

  // Spain NIF / CIF / NIE (DNI 8+1 with optional dots/hyphen, K/L/M NIFs, CIF 1+7+1, NIE X/Y/Z+7/8+1)
  NIF_CIF_ES:
    /\b((?:\d{8}|\d{2}\.\d{3}\.\d{3})\s*(?:-\s*)?[A-Za-z]|[KLMXYZklmxyz]\s*(?:[-.]\s*)?\d{7,8}\s*(?:[-.]\s*)?[A-Za-z]|[A-HJ-NP-SUVWa-hj-np-suvw]\s*(?:[-.]\s*)?\d{7}\s*(?:[-.]\s*)?[0-9A-Ja-j])\b/g,

  // Mexico RFC (3-4 letters, 6 digits, 3 homoclave characters)
  RFC_MX: /\b([A-Z&Ñ]{3,4}-?\d{6}-?[A-Z0-9]{3})\b/gi,

  // US EIN (XX-XXXXXXX or preceded by EIN / Tax ID / FEIN with optional #)
  EIN_US: /\b(\d{2}-\d{7})\b|\b(?:EIN|Tax\s+ID|FEIN)[\s:#-]*(\d{2}-?\d{7})\b/gi,

  // IBAN (ISO 13616: 2 letters, 2 digits, up to 30 alphanumeric with space or hyphen block matching)
  IBAN: /\b([A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){2,7}(?:[\s-]?[A-Z0-9]{1,4})?)\b/gi,

  // SWIFT / BIC (8 or 11 characters)
  SWIFT_BIC: /\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/g,

  // Card PAN (13 to 19 digits, bounded separator length)
  CARD_PAN: /\b\d(?:[ -]{0,2}\d){12,18}\b/g,

  // FOB, CIF, DAP, EXW prices & costs (supports USD/EUR/VES/CNY/RMB/¥ and thousands separators, linear O(N) ReDoS-safe)
  FOB_COST:
    /(?:\b(?:P\.?\s*Unit(?:ario)?|Precio(?:\s*Unit(?:ario)?)?|Unit\s*Cost|Total|Costo\s*(?:Total)?|Valor\s*(?:Total)?)\s*(?:\((?:FOB|CIF|CFR|EXW|DDP|DAP)\)|FOB|CIF|CFR|EXW|DDP|DAP)?|\b(?:FOB|CIF|CFR|EXW|DDP|DAP)\s*(?:Unit\s*Cost|Price|Total)?)[\s:]+(?:(?:\$|USD|EUR|VES|CNY|RMB|Bs\.?|€|¥)\s*)?(?:\d{1,3}(?:[.,]\d{3}){1,4}(?:[.,]\d{1,2})?|\d{1,9}(?:[.,]\d{1,2})?)(?:\s*(?:USD|EUR|VES|CNY|RMB|Bs\.?|€|¥))?(?:\s*(?:FOB|CIF|CFR|EXW|DDP|DAP))?|(?:\b(?:USD|EUR|VES|CNY|RMB|Bs\.?)\s*|[$€¥]\s*)?(?:\d{1,3}(?:[.,]\d{3}){1,4}(?:[.,]\d{1,2})?|\d{1,9}(?:[.,]\d{1,2})?)(?:\s*(?:\$|USD|EUR|VES|CNY|RMB|Bs\.?|€|¥))?\s+(?:FOB|CIF|DAP|EXW|CFR|DDP)\b|\b(?:FOB|CIF|DAP|EXW|CFR|DDP)\s+(?:(?:\$|USD|EUR|VES|CNY|RMB|Bs\.?|€|¥)\s*)?(?:\d{1,3}(?:[.,]\d{3}){1,4}(?:[.,]\d{1,2})?|\d{1,9}(?:[.,]\d{1,2})?)(?:\s*(?:\$|USD|EUR|VES|CNY|RMB|Bs\.?|€|¥))?/gi,

  // Commercial margins
  COMMERCIAL_MARGIN:
    /\b(?:margen|gross margin|profit margin)\s*(?:[:=]\s*)?(\d{1,2}(?:[.,]\d{1,2})?%)/gi,
};

/**
 * Detects all sensitive PII, fiscal identifiers, banking data, and confidential commercial costs in text.
 * Resolves overlapping tokens by selecting the longer match or earlier match.
 */
export function detectPiiEntities(text: string): DetectedPii[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  const matches: DetectedPii[] = [];
  let m: RegExpExecArray | null;

  // 1. Venezuelan SENIAT RIF (hyphenated, unhyphenated, spaced, dotted)
  const rifRegex = new RegExp(PII_PATTERNS.RIF_VE.source, "gi");
  while ((m = rifRegex.exec(text)) !== null) {
    const raw = m[0];
    const letter = (m[1] ?? "").toUpperCase();
    const body = m[2] ?? "";
    const check = m[3] ?? "";
    matches.push({
      type: "rif_ve",
      raw,
      normalized: `${letter}-${body}-${check}`,
      start: m.index,
      end: m.index + raw.length,
    });
  }

  // 1b. Venezuelan Cédula de Identidad (6-8 digits) -> vaulted under deterministic `rif_ve` HMAC
  const cedulaRegex = new RegExp(PII_PATTERNS.CEDULA_VE.source, "gi");
  while ((m = cedulaRegex.exec(text)) !== null) {
    const raw = m[0];
    const letter = (m[1] ?? m[3] ?? "V").toUpperCase();
    const digits = m[2] ?? m[4] ?? "";
    matches.push({
      type: "rif_ve",
      raw,
      normalized: `${letter}-${digits}`,
      start: m.index,
      end: m.index + raw.length,
    });
  }

  // 2. Spanish NIF / CIF / NIE
  const esRegex = new RegExp(PII_PATTERNS.NIF_CIF_ES.source, "gi");
  while ((m = esRegex.exec(text)) !== null) {
    const raw = m[0];
    matches.push({
      type: "nif_cif_es",
      raw,
      normalized: raw.replace(/[\s.-]/g, "").toUpperCase(),
      start: m.index,
      end: m.index + raw.length,
    });
  }

  // 3. Mexican RFC
  const rfcRegex = new RegExp(PII_PATTERNS.RFC_MX.source, "gi");
  while ((m = rfcRegex.exec(text)) !== null) {
    const raw = m[0];
    matches.push({
      type: "rfc_mx",
      raw,
      normalized: raw.replace(/[\s.-]/g, "").toUpperCase(),
      start: m.index,
      end: m.index + raw.length,
    });
  }

  // 4. US EIN
  const einRegex = new RegExp(PII_PATTERNS.EIN_US.source, "gi");
  while ((m = einRegex.exec(text)) !== null) {
    const raw = m[0];
    const digitsOnly = (m[1] ?? m[2] ?? raw).replace(/\D/g, "");
    if (digitsOnly.length === 9) {
      matches.push({
        type: "ein_us",
        raw,
        normalized: `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`,
        start: m.index,
        end: m.index + raw.length,
      });
    }
  }

  /**
   * Standard ISO 13616 IBAN lengths by country code.
   */
  const IBAN_STANDARD_LENGTHS: Record<string, number> = {
    AL: 28,
    AD: 24,
    AT: 20,
    AZ: 28,
    BH: 22,
    BY: 28,
    BE: 16,
    BA: 20,
    BR: 29,
    BG: 22,
    CR: 22,
    HR: 21,
    CY: 28,
    CZ: 24,
    DK: 18,
    DO: 28,
    EE: 20,
    FO: 18,
    FI: 18,
    FR: 27,
    GE: 22,
    DE: 22,
    GI: 23,
    GR: 27,
    GL: 18,
    GT: 28,
    HU: 28,
    IS: 26,
    IE: 22,
    IL: 23,
    IT: 27,
    JO: 30,
    KZ: 20,
    XK: 20,
    KW: 30,
    LV: 21,
    LB: 28,
    LI: 21,
    LT: 20,
    LU: 20,
    MK: 19,
    MT: 31,
    MR: 27,
    MU: 30,
    MD: 24,
    MC: 27,
    ME: 22,
    NL: 18,
    NO: 15,
    PK: 24,
    PS: 29,
    PL: 28,
    PT: 25,
    QA: 29,
    RO: 24,
    LC: 32,
    SM: 27,
    ST: 25,
    SA: 24,
    RS: 22,
    SC: 31,
    SK: 24,
    SI: 19,
    ES: 24,
    SE: 24,
    CH: 21,
    TN: 24,
    TR: 26,
    AE: 23,
    GB: 22,
    VA: 22,
    VG: 24,
  };

  // 5. IBAN
  const ibanRegex = new RegExp(PII_PATTERNS.IBAN.source, "gi");
  while ((m = ibanRegex.exec(text)) !== null) {
    let raw = m[0];
    const country = raw.slice(0, 2).toUpperCase();
    const expected = IBAN_STANDARD_LENGTHS[country];
    if (expected) {
      let count = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw[i];
        if (char && /[A-Z0-9]/i.test(char)) {
          count++;
          if (count === expected) {
            const truncated = raw.slice(0, i + 1);
            if (truncated.length < raw.length) {
              raw = truncated;
              // Rewind regex cursor so adjacent IBANs/PANs on the same line are not skipped (F-08)
              ibanRegex.lastIndex = m.index + raw.length;
            }
            break;
          }
        }
      }
    }
    const clean = raw.replace(/[\s-]/g, "").toUpperCase();
    if (clean.length >= 15 && clean.length <= 34) {
      matches.push({
        type: "iban",
        raw,
        normalized: clean,
        start: m.index,
        end: m.index + raw.length,
      });
    }
  }

  // 6. SWIFT / BIC
  const KNOWN_SWIFT_BANK_PREFIXES = new Set([
    "BANC",
    "BBVA",
    "BSCH",
    "CHAS",
    "CITI",
    "DEUT",
    "HSBC",
    "MIDL",
    "PNBP",
    "UBSW",
    "BOFA",
    "BARC",
    "BNPA",
    "COBA",
    "CRES",
    "INGB",
    "NWBK",
    "RABO",
    "SOGE",
    "SCBL",
    "WFBI",
  ]);

  const ISO_3166_ALPHA2_COUNTRIES = new Set([
    "AD",
    "AE",
    "AF",
    "AG",
    "AI",
    "AL",
    "AM",
    "AO",
    "AQ",
    "AR",
    "AS",
    "AT",
    "AU",
    "AW",
    "AX",
    "AZ",
    "BA",
    "BB",
    "BD",
    "BE",
    "BF",
    "BG",
    "BH",
    "BI",
    "BJ",
    "BL",
    "BM",
    "BN",
    "BO",
    "BQ",
    "BR",
    "BS",
    "BT",
    "BV",
    "BW",
    "BY",
    "BZ",
    "CA",
    "CC",
    "CD",
    "CF",
    "CG",
    "CH",
    "CI",
    "CK",
    "CL",
    "CM",
    "CN",
    "CO",
    "CR",
    "CU",
    "CV",
    "CW",
    "CX",
    "CY",
    "CZ",
    "DE",
    "DJ",
    "DK",
    "DM",
    "DO",
    "DZ",
    "EC",
    "EE",
    "EG",
    "EH",
    "ER",
    "ES",
    "ET",
    "FI",
    "FJ",
    "FK",
    "FM",
    "FO",
    "FR",
    "GA",
    "GB",
    "GD",
    "GE",
    "GF",
    "GG",
    "GH",
    "GI",
    "GL",
    "GM",
    "GN",
    "GP",
    "GQ",
    "GR",
    "GS",
    "GT",
    "GU",
    "GW",
    "GY",
    "HK",
    "HM",
    "HN",
    "HR",
    "HT",
    "HU",
    "ID",
    "IE",
    "IL",
    "IM",
    "IN",
    "IO",
    "IQ",
    "IR",
    "IS",
    "IT",
    "JE",
    "JM",
    "JO",
    "JP",
    "KE",
    "KG",
    "KH",
    "KI",
    "KM",
    "KN",
    "KP",
    "KR",
    "KW",
    "KY",
    "KZ",
    "LA",
    "LB",
    "LC",
    "LI",
    "LK",
    "LR",
    "LS",
    "LT",
    "LU",
    "LV",
    "LY",
    "MA",
    "MC",
    "MD",
    "ME",
    "MF",
    "MG",
    "MH",
    "MK",
    "ML",
    "MM",
    "MN",
    "MO",
    "MP",
    "MQ",
    "MR",
    "MS",
    "MT",
    "MU",
    "MV",
    "MW",
    "MX",
    "MY",
    "MZ",
    "NA",
    "NC",
    "NE",
    "NF",
    "NG",
    "NI",
    "NL",
    "NO",
    "NP",
    "NR",
    "NU",
    "NZ",
    "OM",
    "PA",
    "PE",
    "PF",
    "PG",
    "PH",
    "PK",
    "PL",
    "PM",
    "PN",
    "PR",
    "PS",
    "PT",
    "PW",
    "PY",
    "QA",
    "RE",
    "RO",
    "RS",
    "RU",
    "RW",
    "SA",
    "SB",
    "SC",
    "SD",
    "SE",
    "SG",
    "SH",
    "SI",
    "SJ",
    "SK",
    "SL",
    "SM",
    "SN",
    "SO",
    "SR",
    "SS",
    "ST",
    "SV",
    "SX",
    "SY",
    "SZ",
    "TC",
    "TD",
    "TF",
    "TG",
    "TH",
    "TJ",
    "TK",
    "TL",
    "TM",
    "TN",
    "TO",
    "TR",
    "TT",
    "TV",
    "TW",
    "TZ",
    "UA",
    "UG",
    "UM",
    "US",
    "UY",
    "UZ",
    "VA",
    "VC",
    "VE",
    "VG",
    "VI",
    "VN",
    "VU",
    "WF",
    "WS",
    "XK",
    "YE",
    "YT",
    "ZA",
    "ZM",
    "ZW",
  ]);

  const COMMON_COMMERCE_WORDS = new Set([
    "PURCHASE",
    "CUSTOMER",
    "DELIVERY",
    "SHIPPING",
    "SHIPMENT",
    "DOCUMENT",
    "QUANTITY",
    "DISCOUNT",
    "SUBTOTAL",
    "TERMINAL",
    "TRANSFER",
    "PAYMENTS",
    "NATIONAL",
    "CURRENCY",
    "CATEGORY",
    "SUPPLIER",
    "CONTRACT",
    "CONTAINS",
    "ORIGINAL",
    "RECEIVED",
    "APPROVED",
    "PACKINGS",
    "INVOICES",
    "STANDARD",
    "INCLUDED",
    "MERCHANDISE",
  ]);

  const swiftRegex = new RegExp(PII_PATTERNS.SWIFT_BIC.source, "g");
  while ((m = swiftRegex.exec(text)) !== null) {
    const raw = m[0];
    const isContextual = /\b(?:SWIFT|BIC)\s*(?:[:=#-]\s*)?$/i.test(
      text.slice(Math.max(0, m.index - 20), m.index),
    );
    const bankPrefix = raw.slice(0, 4).toUpperCase();
    const countryCode = raw.slice(4, 6).toUpperCase();
    const hasKnownBankPrefix = KNOWN_SWIFT_BANK_PREFIXES.has(bankPrefix);
    const hasValidCountry = ISO_3166_ALPHA2_COUNTRIES.has(countryCode);
    const hasLocationDigits = /\d/.test(raw.slice(6));
    const isStandardSwift =
      /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(raw);

    if (
      isContextual ||
      (!COMMON_COMMERCE_WORDS.has(raw.toUpperCase()) &&
        hasValidCountry &&
        (raw.endsWith("XXX") ||
          hasKnownBankPrefix ||
          (isStandardSwift && hasLocationDigits)))
    ) {
      matches.push({
        type: "swift_bic",
        raw,
        normalized: raw.toUpperCase(),
        start: m.index,
        end: m.index + raw.length,
      });
    }
  }

  // 7. Credit Card PAN (Luhn + ISO/IEC 7812 IIN/MII verified)
  const cardRegex = new RegExp(PII_PATTERNS.CARD_PAN.source, "g");
  while ((m = cardRegex.exec(text)) !== null) {
    const raw = m[0];
    const clean = raw.replace(/[\s-]/g, "");
    if (isPaymentCardPan(clean)) {
      matches.push({
        type: "card_pan",
        raw,
        normalized: clean,
        start: m.index,
        end: m.index + raw.length,
      });
    }
  }

  // 8. Confidential FOB Cost & Margins
  const fobRegex = new RegExp(PII_PATTERNS.FOB_COST.source, "gi");
  while ((m = fobRegex.exec(text)) !== null) {
    const fullMatch = m[0];
    const trimmedStart = fullMatch.trimStart();
    const leadingOffset = fullMatch.length - trimmedStart.length;
    const raw = trimmedStart.trimEnd();
    if (raw.length > 0) {
      matches.push({
        type: "fob_cost",
        raw,
        normalized: raw,
        start: m.index + leadingOffset,
        end: m.index + leadingOffset + raw.length,
      });
    }
  }

  const marginRegex = new RegExp(PII_PATTERNS.COMMERCIAL_MARGIN.source, "gi");
  while ((m = marginRegex.exec(text)) !== null) {
    const raw = m[0];
    matches.push({
      type: "commercial_margin",
      raw,
      normalized: raw.trim(),
      start: m.index,
      end: m.index + raw.length,
    });
  }

  // Sort by start index ascending, and prioritize longer matches on overlap
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  // Filter overlapping matches
  const nonOverlapping: DetectedPii[] = [];
  let lastEnd = 0;

  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }

  return nonOverlapping;
}
