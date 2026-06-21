import type { APIEvent } from "@solidjs/start/server";

// Read the backend port at runtime, not at build time.
// This respects the BACKEND_INTERNAL_PORT env var configured by the user.
const getBackendUrl = () =>
  `http://localhost:${process.env.BACKEND_INTERNAL_PORT || 3001}`;

async function proxyToBackend(event: APIEvent): Promise<Response> {
  const url = new URL(event.request.url);
  const target = `${getBackendUrl()}${url.pathname}${url.search}`;

  const hasBody =
    event.request.method !== "GET" && event.request.method !== "HEAD";

  let body: BodyInit | undefined;
  let duplex: string | undefined;

  if (hasBody) {
    const contentType = event.request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // Buffer multipart bodies as ArrayBuffer to avoid ReadableStream locking
      // issues when proxying through reverse proxies (e.g. Traefik with HTTP/2
      // → HTTP/1.1 downgrade). Streaming a ReadableStream through two fetch()
      // calls in Nitro can result in a locked/drained body reaching the backend.
      body = await event.request.arrayBuffer();
    } else {
      body = event.request.body ?? undefined;
      // Required for streaming request bodies in Node 18+
      duplex = "half";
    }
  }

  return fetch(target, {
    method: event.request.method,
    headers: event.request.headers,
    body,
    // @ts-ignore
    ...(duplex ? { duplex } : {}),
  });
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const DELETE = proxyToBackend;
export const PATCH = proxyToBackend;
