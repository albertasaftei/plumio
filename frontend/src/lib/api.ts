// src/lib/api.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface Document {
  name: string;
  path: string;
  type: "file" | "folder";
  modified: string;
  size: number;
  color?: string;
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

  private decodeToken(): {
    userId: number;
    username: string;
    isAdmin: boolean;
  } | null {
    if (!this.token) return null;
    try {
      // JWT format: header.payload.signature
      const payload = this.token.split(".")[1];
      if (!payload) return null;

      // Decode base64url
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(base64));
      return decoded;
    } catch {
      return null;
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

  async setup(username: string, email: string, password: string) {
    return this.request("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(username: string, password: string) {
    const result = await this.request<{
      token: string;
      username: string;
      isAdmin?: boolean;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(result.token);
    return result;
  }

  isAdmin(): boolean {
    const decoded = this.decodeToken();
    return decoded?.isAdmin ?? false;
  }

  // Admin - User Management
  async listUsers() {
    return this.request<{
      users: Array<{
        id: number;
        username: string;
        email: string;
        createdAt: string;
        isAdmin: boolean;
      }>;
    }>("/api/auth/admin/users");
  }

  async createUser(username: string, email: string, password: string) {
    return this.request("/api/auth/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async deleteUser(userId: number) {
    return this.request(`/api/auth/admin/users/${userId}`, {
      method: "DELETE",
    });
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

  async setItemColor(path: string, color: string | null) {
    return this.request("/api/documents/color", {
      method: "POST",
      body: JSON.stringify({ path, color }),
    });
  }

  async exportDocuments() {
    const response = await fetch(`${API_URL}/api/documents/export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("pluma_token")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Export failed");
    }

    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pluma-export-${new Date().toISOString().slice(0, 10)}.tar.gz`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async importDocuments(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/api/documents/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("pluma_token")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Import failed");
    }

    return response.json();
  }
}

export const api = new ApiClient();

// Export standalone functions for convenience
export const exportDocuments = () => api.exportDocuments();
export const importDocuments = (file: File) => api.importDocuments(file);
