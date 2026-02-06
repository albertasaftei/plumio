// src/lib/api.ts
// Check if demo mode is enabled
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

// Dynamically construct API URL for separate frontend/backend ports
const getApiUrl = () => {
  if (typeof window === "undefined") {
    // Server-side: use localhost
    return "http://localhost:3001";
  }

  // Check for build-time env var first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Client-side: detect backend port
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  // If frontend is on a custom port, assume backend is on next port
  if (port && port !== "80" && port !== "443") {
    const backendPort = parseInt(port) + 1;
    return `${protocol}//${hostname}:${backendPort}`;
  }

  // Default: assume backend on port 3001
  return `${protocol}//${hostname}:3001`;
};

const API_URL = getApiUrl();

export interface Document {
  name: string;
  path: string;
  type: "file" | "folder";
  modified: string;
  size: number;
  color?: string;
  favorite?: boolean;
  archived_at?: string;
  deleted_at?: string;
}

export class ApiClient {
  private token: string | null = null;

  constructor() {
    // Only access localStorage in browser environment (not during SSR)
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("plumio_token");
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("plumio_token", token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("plumio_token");
      localStorage.removeItem("plumio_current_org");
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

  async validateSession(): Promise<boolean> {
    if (!this.token) return false;
    try {
      await this.request<{ valid: boolean; userId: number; username: string }>(
        "/api/auth/validate",
      );
      return true;
    } catch {
      // Token is invalid or expired, clear it
      this.clearToken();
      return false;
    }
  }

  async setup(username: string, email: string, password: string) {
    return this.request("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async register(username: string, email: string, password: string) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(username: string, password: string) {
    const result = await this.request<{
      token: string;
      username: string;
      isAdmin?: boolean;
      currentOrganization: {
        id: number;
        name: string;
        slug: string;
        role: string;
      };
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(result.token);

    // Store current organization in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "plumio_current_org",
        JSON.stringify(result.currentOrganization),
      );
    }

    return result;
  }

  async getCurrentOrganization(): Promise<{
    id: number;
    name: string;
    slug: string;
    role: string;
  } | null> {
    if (typeof window !== "undefined") {
      const orgStr = localStorage.getItem("plumio_current_org");
      if (orgStr) {
        try {
          return JSON.parse(orgStr);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  isAdmin(): boolean {
    const decoded = this.decodeToken();
    return decoded?.isAdmin ?? false;
  }

  async isOrgAdmin(): Promise<boolean> {
    const org = await this.getCurrentOrganization();
    if (!org) return false;

    try {
      // Fetch role from backend to ensure it's not tampered with
      const data = await this.request<{ role: string }>(
        `/api/organizations/${org.id}/role`,
      );

      // Update localStorage with server-validated role
      const updatedOrg = { ...org, role: data.role };
      localStorage.setItem("plumio_current_org", JSON.stringify(updatedOrg));

      return data.role === "admin";
    } catch (error) {
      console.error("Error verifying admin status:", error);
      return false;
    }
  }

  // Synchronous version for immediate UI checks (uses cached value from localStorage)
  // WARNING: This should only be used for UI display, not authorization decisions
  async isOrgAdminCached(): Promise<boolean> {
    const org = await this.getCurrentOrganization();
    return org?.role === "admin";
  }

  async getUsername(): Promise<string | null> {
    const decoded = this.decodeToken();
    return decoded?.username ?? null;
  }

  // Organizations
  async listOrganizations() {
    return this.request<{
      organizations: Array<{
        id: number;
        name: string;
        slug: string;
        role: string;
        createdAt: string;
      }>;
    }>("/api/organizations");
  }

  async getOrganization(orgId: number) {
    return this.request<{
      organization: {
        id: number;
        name: string;
        slug: string;
        role: string;
        createdAt: string;
      };
    }>(`/api/organizations/${orgId}`);
  }

  async switchOrganization(orgId: number) {
    const result = await this.request<{
      message: string;
      organizationId: number;
      token: string;
      organization: {
        id: number;
        name: string;
        slug: string;
        role: string;
      };
    }>(`/api/organizations/${orgId}/switch`, {
      method: "POST",
    });

    // Update token with new JWT
    this.setToken(result.token);

    // Update localStorage with new organization
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "plumio_current_org",
        JSON.stringify(result.organization),
      );
    }

    return result;
  }

  async updateOrganization(orgId: number, name: string, slug: string) {
    return this.request(`/api/organizations/${orgId}`, {
      method: "PUT",
      body: JSON.stringify({ name, slug }),
    });
  }

  async listOrgMembers(orgId: number) {
    return this.request<{
      members: Array<{
        id: number;
        username: string;
        email: string;
        role: string;
        joinedAt: string;
      }>;
    }>(`/api/organizations/${orgId}/members`);
  }

  async addOrgMember(orgId: number, username: string, role: string = "member") {
    return this.request(`/api/organizations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify({ username, role }),
    });
  }

  async updateOrgMemberRole(orgId: number, userId: number, role: string) {
    return this.request(`/api/organizations/${orgId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  }

  async removeOrgMember(orgId: number, userId: number) {
    return this.request(`/api/organizations/${orgId}/members/${userId}`, {
      method: "DELETE",
    });
  }

  // Admin - User Management (Global Admin)
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

  async saveDocument(path: string, content: string, isNew: boolean = false) {
    return this.request<{ message: string; path: string }>(
      "/api/documents/save",
      {
        method: "POST",
        body: JSON.stringify({ path, content, isNew }),
      },
    );
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
        Authorization: `Bearer ${localStorage.getItem("plumio_token")}`,
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
    a.download = `plumio-export-${new Date().toISOString().slice(0, 10)}.tar.gz`;
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
        Authorization: `Bearer ${localStorage.getItem("plumio_token")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Import failed");
    }

    return response.json();
  }

  async archiveDocument(path: string) {
    return this.request("/api/documents/archive", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async unarchiveDocument(path: string) {
    return this.request("/api/documents/unarchive", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async listArchivedDocuments() {
    return this.request<{ items: Document[] }>("/api/documents/archived");
  }

  async permanentlyDeleteDocument(path: string) {
    return this.request("/api/documents/archive/delete", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async listDeletedDocuments() {
    return this.request<{ items: Document[] }>("/api/documents/deleted");
  }

  async restoreDeletedDocument(path: string) {
    return this.request("/api/documents/deleted/restore", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async permanentlyDeleteFromTrash(path: string) {
    return this.request("/api/documents/deleted/permanent", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async toggleFavorite(path: string, favorite: boolean) {
    return this.request("/api/documents/favorite", {
      method: "POST",
      body: JSON.stringify({ path, favorite }),
    });
  }
}

// Conditional API client - uses demo client in demo mode, otherwise real API client
function createApiClient() {
  if (isDemoMode) {
    console.log("importing demo client");
    // Dynamically import demo client
    return import("./demo/demo-client").then((mod) => mod.demoClient);
  }
  return Promise.resolve(new ApiClient());
}

// Export a proxy that lazy-loads the appropriate client
let clientPromise: Promise<
  ApiClient | typeof import("./demo/demo-client").demoClient
> | null = null;

function getClient() {
  if (!clientPromise) {
    console.log("demo not enabled ");

    clientPromise = createApiClient();
  }
  return clientPromise;
}

// Export a proxy object that forwards all calls to the appropriate client
export const api = new Proxy({} as ApiClient, {
  get(target, prop) {
    return async (...args: any[]) => {
      const client = await getClient();
      const method = (client as any)[prop];
      if (typeof method === "function") {
        return method.apply(client, args);
      }
      return method;
    };
  },
});

// Export standalone functions for convenience
export const exportDocuments = () => api.exportDocuments();
export const importDocuments = (file: File) => api.importDocuments(file);
