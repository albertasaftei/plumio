import type { APIEvent } from "@solidjs/start/server";

// Read the backend port at runtime, not at build time.
// This respects the BACKEND_INTERNAL_PORT env var configured by the user.
const getBackendUrl = () =>
  process.env.BACKEND_INTERNAL_URL ||
  `http://localhost:${process.env.BACKEND_INTERNAL_PORT || 3001}`;

async function proxyToBackend(event: APIEvent): Promise<Response> {
  const url = new URL(event.request.url);
  const target = `${getBackendUrl()}${url.pathname}${url.search}`;

  const hasBody =
    event.request.method !== "GET" && event.request.method !== "HEAD";

  return fetch(target, {
    method: event.request.method,
    headers: event.request.headers,
    body: hasBody ? event.request.body : undefined,
    // Required for streaming request bodies in Node 18+
    // @ts-ignore
    duplex: "half",
  });
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const DELETE = proxyToBackend;
export const PATCH = proxyToBackend;
