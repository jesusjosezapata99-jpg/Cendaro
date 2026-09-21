import { describe, expect, it } from "vitest";

import { readBodyWithByteLimit } from "~/lib/request-body-limit";

function streamedPost(body: Uint8Array): Request {
  return new Request("http://localhost/api/trpc/search.global", {
    method: "POST",
    // No content-length header is generated for a stream body — which is
    // exactly the case the helper exists for.
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
}

describe("F9.4: byte-capped body read for streamed POSTs", () => {
  it("passes through GET requests untouched", async () => {
    const req = new Request("http://localhost/api/trpc/search.global");
    const result = await readBodyWithByteLimit(req, 100);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request).toBe(req);
    }
  });

  it("returns the rebuilt request when the body fits", async () => {
    const result = await readBodyWithByteLimit(
      streamedPost(new TextEncoder().encode('{"q":"tornillo"}')),
      1024,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const text = await result.request.text();
      expect(text).toBe('{"q":"tornillo"}');
      expect(result.request.method).toBe("POST");
    }
  });

  it("rejects (413 semantics) as soon as the cap is exceeded", async () => {
    const big = new Uint8Array(2048);
    const result = await readBodyWithByteLimit(streamedPost(big), 1024);

    expect(result.ok).toBe(false);
  });

  it("rejects a stream that keeps producing after the cap", async () => {
    // Emulates an endless chunked upload: the read loop must stop at the
    // cap, not wait for the stream to end.
    let reads = 0;
    const endless = new Request("http://localhost/api/trpc/x", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array(512));
        },
      }),
      duplex: "half",
    } as RequestInit);

    const result = await readBodyWithByteLimit(endless, 1024);

    expect(result.ok).toBe(false);
    // 1024/512 = 3 reads max; an unbounded loop would hang the test.
    expect(reads).toBeLessThanOrEqual(4);
  });
});
