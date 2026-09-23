/**
 * Byte-capped body reads for POST requests without content-length
 * (PLAN-2026-09-SECURITY-REMEDIATION F9.4, finding L2).
 *
 * The tRPC route handler rejected oversized bodies by reading the
 * `content-length` header — but a chunked/streamed POST carries no such
 * header, so the guard never fired and the framework buffered whatever the
 * client chose to send. This helper reads the body once with a hard byte
 * cap and returns a rebuilt Request the framework can consume normally.
 *
 * Memory bound: the read loop aborts as soon as the cap is exceeded, so the
 * worst case allocates maxBytes + one chunk — never the full stream.
 */
export type BodyLimitResult = { ok: true; request: Request } | { ok: false };

export async function readBodyWithByteLimit(
  request: Request,
  maxBytes: number,
): Promise<BodyLimitResult> {
  // A present content-length is validated by the caller (header check in the
  // route). Anything else with a body must be read to be measured.
  if (request.method !== "POST" || !request.body) {
    return { ok: true, request };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      // Cancel the stream so the producer is not left writing into a
      // response nobody will read.
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    request: new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
      // undici requires `duplex: "half"` for any body; the DOM
      // RequestInit type in this TS lib does not know the property yet.
      duplex: "half",
    } as RequestInit),
  };
}
