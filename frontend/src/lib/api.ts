// src/lib/api.ts
// Check if demo mode is enabled
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

// Dynamically construct API URL for separate frontend/backend ports
const getApiUrl = () => {
  if (typeof window === "undefined") {
    // Server-side (SSR): talk directly to the backend on localhost
    return `http://localhost:${process.env.BACKEND_INTERNAL_PORT || 3001}`;
  }

  // Check for build-time env var first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Client-side: use the same origin so the request goes through the frontend
  // server, which proxies /api/* to the backend internally.
  // This works whether the app is accessed directly on port 3000 or behind a
  // reverse proxy (e.g. Nginx Proxy Manager) on port 80/443 with no backend
  // port exposed.
  return window.location.origin;
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

  async setup(
    username: string,
    email: string,
    password: string,
    organizationName?: string,
  ) {
    return this.request("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ username, email, password, organizationName }),
    });
  }

  async register(
    username: string,
    email: string,
    password: string,
    organizationName?: string,
  ) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password, organizationName }),
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

  async updateUsername(username: string) {
    const result = await this.request<{ message: string; token: string }>(
      "/api/auth/profile",
      {
        method: "PUT",
        body: JSON.stringify({ username }),
      },
    );
    // Store the new token so the updated username is reflected immediately
    this.setToken(result.token);
    return result;
  }

  getCurrentUserId(): number | null {
    const decoded = this.decodeToken();
    return decoded?.userId ?? null;
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

  async createUser(
    username: string,
    email: string,
    password: string,
    isAdmin: boolean = false,
  ) {
    return this.request("/api/auth/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, email, password, isAdmin }),
    });
  }

  async updateUserAdminStatus(userId: number, isAdmin: boolean) {
    return this.request(`/api/auth/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ isAdmin }),
    });
  }

  async deleteUser(userId: number) {
    return this.request(`/api/auth/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  // App Config
  async getConfig() {
    return this.request<Record<string, boolean | string>>("/api/config");
  }

  async getAdminSettings() {
    return this.request<{ settings: Record<string, string> }>(
      "/api/auth/admin/settings",
    );
  }

  async updateAdminSetting(key: string, value: string) {
    return this.request("/api/auth/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ key, value }),
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

  async saveDocument(
    path: string,
    content: string,
    isNew: boolean = false,
    folder?: string,
    name?: string,
  ) {
    return this.request<{ message: string; path: string }>(
      "/api/documents/save",
      {
        method: "POST",
        body: JSON.stringify({
          path: path || undefined,
          content,
          isNew,
          folder,
          name,
        }),
      },
    );
  }

  async createFolder(path: string, folder?: string, name?: string) {
    return this.request("/api/documents/folder", {
      method: "POST",
      body: JSON.stringify({ path: path || undefined, folder, name }),
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

  async renameItem(oldPath: string, newName: string) {
    return this.request<{ message: string; newPath: string }>(
      "/api/documents/rename",
      {
        method: "POST",
        body: JSON.stringify({ oldPath, newName }),
      },
    );
  }

  async moveItem(sourcePath: string, destinationFolder: string) {
    return this.request<{ message: string; newPath: string }>(
      "/api/documents/move",
      {
        method: "POST",
        body: JSON.stringify({ sourcePath, destinationFolder }),
      },
    );
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
        Authorization: `Bearer ${this.token}`,
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
        Authorization: `Bearer ${this.token}`,
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

  async duplicateItem(path: string) {
    return this.request<{ message: string; newPath: string }>(
      "/api/documents/duplicate",
      {
        method: "POST",
        body: JSON.stringify({ path }),
      },
    );
  }

  async searchDocuments(query: string) {
    return this.request<{
      results: Array<{
        path: string;
        title: string;
        color: string | null;
        modified: string;
        size: number;
        snippet: string;
      }>;
    }>(`/api/documents/search?q=${encodeURIComponent(query)}`);
  }

  // Attachments
  async uploadAttachment(documentPath: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentPath", documentPath);

    const response = await fetch(`${API_URL}/api/attachments/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Upload failed");
    }

    return response.json() as Promise<{
      message: string;
      filename: string;
      originalName: string;
      path: string;
      mimeType: string;
      size: number;
    }>;
  }

  async listAttachments(documentPath: string) {
    return this.request<{
      attachments: Array<{
        id: number;
        organization_id: number;
        document_path: string;
        filename: string;
        original_name: string;
        mime_type: string;
        size: number;
        uploaded_at: string;
        path: string;
      }>;
    }>(
      `/api/attachments/list?documentPath=${encodeURIComponent(documentPath)}`,
    );
  }

  async deleteAttachment(attachmentPath: string) {
    const response = await fetch(
      `${API_URL}/api/attachments/delete?path=${encodeURIComponent(attachmentPath)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.token}` },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to delete attachment");
    }
    return response.json();
  }

  getAttachmentUrl(attachmentPath: string): string {
    return `${API_URL}/api/attachments/file?path=${encodeURIComponent(attachmentPath)}&token=${this.token}`;
  }

  async checkVersion(): Promise<{
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseUrl: string | null;
  }> {
    const currentVersion = (import.meta.env.VITE_APP_VERSION as string) ?? "";
    const result = await this.request<{
      latestVersion: string | null;
      releaseUrl: string | null;
    }>("/api/version/check");

    const isNewer = (latest: string, current: string): boolean => {
      const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
      const [lM, lm, lp] = parse(latest);
      const [cM, cm, cp] = parse(current);
      return (
        lM > cM || (lM === cM && lm > cm) || (lM === cM && lm === cm && lp > cp)
      );
    };

    return {
      updateAvailable: result.latestVersion
        ? isNewer(result.latestVersion, currentVersion)
        : false,
      currentVersion,
      latestVersion: result.latestVersion,
      releaseUrl: result.releaseUrl,
    };
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
