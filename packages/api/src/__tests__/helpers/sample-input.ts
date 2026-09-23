/**
 * Test helper: the smallest valid input for a tRPC procedure, derived from its
 * Zod input schema(s). Shared by the real-database read-procedure suite and the
 * per-role authorization suite, so both call every procedure the same way.
 *
 * Required fields only. An id that matches no row is fine: the query still
 * runs its SQL and answers NOT_FOUND or empty, and authorization runs before
 * the handler either way.
 */
import { z } from "zod/v4";

interface JsonSchema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
}

const SAMPLE_UUID = "00000000-0000-4000-8000-00000000f9f9";

function sampleFor(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  const branch = schema.anyOf?.[0] ?? schema.oneOf?.[0];
  if (branch) return sampleFor(branch);
  if (schema.allOf?.length) {
    return Object.assign({}, ...schema.allOf.map((s) => sampleFor(s)));
  }

  const type = Array.isArray(schema.type)
    ? (schema.type.find((t) => t !== "null") ?? "null")
    : schema.type;

  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const key of schema.required ?? []) {
        const child = schema.properties?.[key];
        if (child) out[key] = sampleFor(child);
      }
      return out;
    }
    case "array": {
      const count = schema.minItems ?? 0;
      return Array.from({ length: count }, () =>
        schema.items ? sampleFor(schema.items) : null,
      );
    }
    case "string": {
      if (schema.format === "uuid") return SAMPLE_UUID;
      if (schema.format === "email") return "f9@example.invalid";
      if (schema.format === "date-time") return new Date().toISOString();
      if (schema.format === "date")
        return new Date().toISOString().slice(0, 10);
      const length = Math.min(
        Math.max(schema.minLength ?? 1, 1),
        schema.maxLength ?? Number.MAX_SAFE_INTEGER,
      );
      return "x".repeat(length);
    }
    case "integer":
    case "number": {
      const floor = schema.minimum ?? 1;
      return schema.maximum !== undefined
        ? Math.min(floor, schema.maximum)
        : floor;
    }
    case "boolean":
      return false;
    default:
      return null;
  }
}

/** Builds a minimal valid input from a procedure's Zod input schema(s). */
export function sampleInput(procedure: {
  _def: { inputs?: unknown[] };
}): unknown {
  const inputs = procedure._def.inputs ?? [];
  if (inputs.length === 0) return undefined;
  const samples = inputs.map((input) =>
    sampleFor(
      z.toJSONSchema(input as z.ZodType, {
        io: "input",
        unrepresentable: "any",
      }) as JsonSchema,
    ),
  );
  return samples.length === 1
    ? samples[0]
    : Object.assign({}, ...(samples as object[]));
}
