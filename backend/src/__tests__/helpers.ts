import { app } from "../app.js";

/**
 * Helper to make requests to the Hono app without starting an HTTP server.
 */
export function request(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
  },
) {
  const headers: Record<string, string> = {
    ...(options?.headers || {}),
  };

  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  let bodyStr: string | undefined;
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(options.body);
  }

  return app.request(path, {
    method,
    headers,
    body: bodyStr,
  });
}

/**
 * Setup the initial admin user via the /api/auth/setup endpoint.
 * Returns the login response with token.
 */
export async function setupAdmin(
  username = "testadmin",
  email = "admin@test.com",
  password = "password123",
  organizationName = "Test Org",
) {
  await request("POST", "/api/auth/setup", {
    body: { username, email, password, organizationName },
  });

  const loginRes = await request("POST", "/api/auth/login", {
    body: { username, password },
  });

  return loginRes.json() as Promise<{
    token: string;
    username: string;
    isAdmin: boolean;
    currentOrganization: {
      id: number;
      name: string;
      slug: string;
      role: string;
    };
  }>;
}

/**
 * Register a new user and log them in. Requires admin to have been set up first.
 */
export async function registerAndLogin(
  username: string,
  email: string,
  password = "password123",
) {
  await request("POST", "/api/auth/register", {
    body: { username, email, password },
  });

  const loginRes = await request("POST", "/api/auth/login", {
    body: { username, password },
  });

  return loginRes.json() as Promise<{
    token: string;
    username: string;
    isAdmin: boolean;
    currentOrganization: {
      id: number;
      name: string;
      slug: string;
      role: string;
    };
  }>;
}
