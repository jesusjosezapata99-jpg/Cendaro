/**
 * Cendaro — Pluralization Utilities
 *
 * Robust Spanish pluralization helpers for ERP UI strings and counters.
 */

/**
 * Returns either the singular or plural noun based on count.
 * In Spanish, 1 is singular; 0 and numbers > 1 are plural.
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return Math.abs(count) === 1 ? singular : plural;
}

/**
 * Formats a number with its pluralized noun (e.g. "1 orden", "5 órdenes", "0 productos").
 * Uses Venezuelan Spanish formatting ("es-VE") by default for thousands separators.
 */
export function formatPlural(
  count: number,
  singular: string,
  plural: string,
  locale = "es-VE",
): string {
  const formattedNumber = count.toLocaleString(locale);
  return `${formattedNumber} ${pluralize(count, singular, plural)}`;
}
