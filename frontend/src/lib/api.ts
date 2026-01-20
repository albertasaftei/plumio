// src/lib/api.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface Document {
  name: string;
  path: string;
  type: "file" | "folder";
  modified: string;
  size: number;
}

export class ApiClient {
  private token: string | null = null;

  constructor() {
    // Only access localStorage in browser environment (not during SSR)
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("pluma_token");
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("pluma_token", token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("pluma_token");
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Auth
  async checkSetup() {
    return this.request<{ needsSetup: boolean }>("/api/auth/check-setup");
  }

  async setup(username: string, password: string) {
    return this.request("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async login(username: string, password: string) {
    const result = await this.request<{ token: string; username: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
    );
    this.setToken(result.token);
    return result;
  }

  // Documents
  async listDocuments(path = "/") {
    return this.request<{ items: Document[] }>(
      `/api/documents/list?path=${encodeURIComponent(path)}`,
    );
  }

  async getDocument(path: string) {
    return this.request<{ content: string; path: string }>(
      `/api/documents/content?path=${encodeURIComponent(path)}`,
    );
  }

  async saveDocument(path: string, content: string) {
    return this.request("/api/documents/save", {
      method: "POST",
      body: JSON.stringify({ path, content }),
    });
  }

  async createFolder(path: string) {
    return this.request("/api/documents/folder", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async deleteItem(path: string) {
    return this.request(
      "/api/documents/delete?path=" + encodeURIComponent(path),
      {
        method: "DELETE",
      },
    );
  }

  async renameItem(oldPath: string, newPath: string) {
    return this.request("/api/documents/rename", {
      method: "POST",
      body: JSON.stringify({ oldPath, newPath }),
    });
  }
}

export const api = new ApiClient();
