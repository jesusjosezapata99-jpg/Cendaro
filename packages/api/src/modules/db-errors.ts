/**
 * Cendaro — Postgres error helpers shared by routers.
 */

/** Postgres unique_violation (23505), directly or wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value
      ? value.code
      : undefined;
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? error.cause
      : undefined;
  return codeOf(error) === "23505" || codeOf(cause) === "23505";
}
