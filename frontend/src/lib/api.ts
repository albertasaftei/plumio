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
  sort_order?: number;
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

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>("/api/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
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

  async getEmail(): Promise<string | null> {
    try {
      const result = await this.request<{ email: string }>("/api/auth/profile");
      return result.email;
    } catch {
      return null;
    }
  }

  async requestEmailChange(newEmail: string) {
    return this.request<{ message: string }>("/api/auth/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail }),
    });
  }

  async confirmEmailChange(token: string) {
    return this.request<{ message: string }>("/api/auth/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
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
        discoverable: number;
        autoAccept: number;
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

  async updateOrgSettings(
    orgId: number,
    discoverable: boolean,
    autoAccept: boolean,
  ) {
    return this.request(`/api/organizations/${orgId}`, {
      method: "PUT",
      body: JSON.stringify({ discoverable, auto_accept: autoAccept }),
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

  // Join Requests
  async getMyMemberships() {
    return this.request<{ orgIds: number[] }>(
      "/api/organizations/my-memberships",
    );
  }

  async listDiscoverableOrgs() {
    return this.request<{
      organizations: Array<{
        id: number;
        name: string;
        slug: string;
      }>;
    }>("/api/join-requests/discoverable-orgs");
  }

  async createJoinRequest(organizationId: number, message?: string) {
    return this.request<{ message: string; autoAccepted?: boolean }>(
      "/api/join-requests",
      {
        method: "POST",
        body: JSON.stringify({ organizationId, message }),
      },
    );
  }

  async listMyJoinRequests() {
    return this.request<{
      requests: Array<{
        id: number;
        organization_id: number;
        status: "pending" | "accepted" | "rejected";
        message: string | null;
        org_name: string;
        org_slug: string;
        created_at: string;
        updated_at: string;
      }>;
    }>("/api/join-requests/mine");
  }

  async listOrgJoinRequests(orgId: number) {
    return this.request<{
      requests: Array<{
        id: number;
        organization_id: number;
        user_id: number;
        status: string;
        message: string | null;
        username: string;
        email: string;
        created_at: string;
      }>;
    }>(`/api/join-requests/org/${orgId}`);
  }

  async acceptJoinRequest(requestId: number) {
    return this.request<{ message: string }>(
      `/api/join-requests/${requestId}/accept`,
      { method: "PUT" },
    );
  }

  async rejectJoinRequest(requestId: number) {
    return this.request<{ message: string }>(
      `/api/join-requests/${requestId}/reject`,
      { method: "PUT" },
    );
  }

  async cancelJoinRequest(requestId: number) {
    return this.request<{ message: string }>(
      `/api/join-requests/${requestId}`,
      { method: "DELETE" },
    );
  }

  // Notifications
  async listNotifications(page: number = 1, limit: number = 20) {
    return this.request<{
      notifications: Array<{
        id: number;
        type: string;
        title: string;
        message: string | null;
        metadata: string | null;
        read: number;
        created_at: string;
      }>;
      page: number;
      limit: number;
    }>(`/api/notifications?page=${page}&limit=${limit}`);
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>("/api/notifications/unread-count");
  }

  async markNotificationRead(id: number) {
    return this.request(`/api/notifications/${id}/read`, { method: "PUT" });
  }

  async markAllNotificationsRead() {
    return this.request("/api/notifications/read-all", { method: "PUT" });
  }

  async deleteNotification(id: number) {
    return this.request(`/api/notifications/${id}`, { method: "DELETE" });
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

  async adminListAllOrgs() {
    return this.request<{
      organizations: Array<{
        id: number;
        name: string;
        slug: string;
        createdAt: string;
      }>;
    }>("/api/auth/admin/organizations");
  }

  async adminGetUserOrgs(userId: number) {
    return this.request<{
      organizations: Array<{
        orgId: number;
        orgName: string;
        orgSlug: string;
        role: string;
        joinedAt: string;
        isOwner: boolean;
      }>;
    }>(`/api/auth/admin/users/${userId}/organizations`);
  }

  async adminAddUserToOrg(
    userId: number,
    orgId: number,
    role: string = "member",
  ) {
    return this.request(`/api/auth/admin/users/${userId}/organizations`, {
      method: "POST",
      body: JSON.stringify({ orgId, role }),
    });
  }

  async adminUpdateUserOrgRole(userId: number, orgId: number, role: string) {
    return this.request(
      `/api/auth/admin/users/${userId}/organizations/${orgId}`,
      {
        method: "PUT",
        body: JSON.stringify({ role }),
      },
    );
  }

  async adminRemoveUserFromOrg(userId: number, orgId: number) {
    return this.request(
      `/api/auth/admin/users/${userId}/organizations/${orgId}`,
      {
        method: "DELETE",
      },
    );
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

  async listAllDocuments() {
    return this.request<{ items: Document[] }>(
      `/api/documents/list?path=/&recursive=true`,
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

  async reorderItem(
    sourcePath: string,
    targetPath: string,
    operation: "reorder-before" | "reorder-after" | "make-child",
  ) {
    return this.request<{ message: string; newPath?: string }>(
      "/api/documents/reorder",
      {
        method: "POST",
        body: JSON.stringify({ sourcePath, targetPath, operation }),
      },
    );
  }

  async setItemColor(path: string, color: string | null) {
    return this.request("/api/documents/color", {
      method: "POST",
      body: JSON.stringify({ path, color }),
    });
  }

  downloadDocumentAsMarkdown(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async downloadDocumentAsPdf(filename: string, content: string) {
    const [{ marked }, { default: mermaid }, { default: katex }, Prism] =
      await Promise.all([
        import("marked"),
        import("mermaid"),
        import("katex"),
        import("prismjs").then(async (m) => {
          // Load common language grammars
          await Promise.allSettled([
            import("prismjs/components/prism-javascript" as string),
            import("prismjs/components/prism-typescript" as string),
            import("prismjs/components/prism-jsx" as string),
            import("prismjs/components/prism-tsx" as string),
            import("prismjs/components/prism-css" as string),
            import("prismjs/components/prism-json" as string),
            import("prismjs/components/prism-bash" as string),
            import("prismjs/components/prism-python" as string),
            import("prismjs/components/prism-rust" as string),
            import("prismjs/components/prism-go" as string),
            import("prismjs/components/prism-sql" as string),
            import("prismjs/components/prism-yaml" as string),
            import("prismjs/components/prism-markdown" as string),
            import("prismjs/components/prism-java" as string),
            import("prismjs/components/prism-c" as string),
            import("prismjs/components/prism-cpp" as string),
          ]);
          return m.default;
        }),
      ]);

    let html = await marked.parse(content);
    const runId = Date.now().toString(36);

    // Render mermaid code blocks to inline SVG.
    // marked outputs: <pre><code class="language-mermaid">...html-encoded source...</code></pre>
    const decodeHtml = (s: string) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    const mermaidRe =
      /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi;
    const mermaidMatches = [...html.matchAll(mermaidRe)];

    if (mermaidMatches.length > 0) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        suppressErrorRendering: true,
        htmlLabels: false,
        flowchart: { htmlLabels: false, useMaxWidth: false },
        sequence: { useMaxWidth: false },
        er: { useMaxWidth: false },
      });

      const svgs = await Promise.all(
        mermaidMatches.map(async (m, i) => {
          try {
            const source = decodeHtml(m[1]).trim();
            const { svg } = await mermaid.render(
              `mermaid-pdf-${runId}-${i}`,
              source,
            );
            return svg as string;
          } catch {
            return null;
          }
        }),
      );

      // Replace from end to start so earlier indices stay valid.
      for (let i = mermaidMatches.length - 1; i >= 0; i--) {
        const m = mermaidMatches[i];
        const svg = svgs[i];
        const replacement = svg
          ? `<div class="mermaid-diagram">${svg}</div>`
          : m[0];
        html =
          html.slice(0, m.index!) +
          replacement +
          html.slice(m.index! + m[0].length);
      }
    }

    // Syntax-highlight fenced code blocks using Prism.
    // marked outputs: <pre><code class="language-{lang}">...html-encoded...</code></pre>
    html = html.replace(
      /<pre><code class="language-([^"]+)">([\/\s\S]*?)<\/code><\/pre>/gi,
      (match, lang, encodedCode) => {
        if (lang === "mermaid") return match; // already handled above
        const grammar =
          Prism.languages[lang] || Prism.languages[lang.toLowerCase()];
        if (!grammar) return match;
        const code = decodeHtml(encodedCode);
        const highlighted = Prism.highlight(code, grammar, lang);
        return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
      },
    );

    // Helper: detect whether a src points to a PDF attachment
    const isPdfSrc = (src: string) => {
      const pathPart = src.split("?")[0].split("#")[0];
      if (/\.pdf$/i.test(pathPart)) return true;
      try {
        const u = new URL(src, window.location.href);
        return /\.pdf$/i.test((u.searchParams.get("path") || "").split("?")[0]);
      } catch {
        return false;
      }
    };

    // Inline images: fetch API attachment images and replace with base64 data URLs
    // so they work correctly when the HTML is opened as a blob URL.
    // PDF attachments are rendered page-by-page via PDF.js into PNG data URLs.
    const imgRe =
      /<img([^>]*?)src="([^"]*\/api\/attachments\/file[^"]*)"([^>]*?)>/gi;
    const imgMatches = [...html.matchAll(imgRe)];
    if (imgMatches.length > 0) {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).href;

      await Promise.all(
        imgMatches.map(async (m) => {
          try {
            const src = m[2];
            const absoluteSrc = src.startsWith("http")
              ? src
              : `${API_URL}${src}`;
            const urlObj = new URL(absoluteSrc);
            if (this.token) urlObj.searchParams.set("token", this.token);
            const resp = await fetch(urlObj.toString(), {
              headers: { Authorization: `Bearer ${this.token}` },
            });
            if (!resp.ok) return;
            const buffer = await resp.arrayBuffer();

            if (isPdfSrc(src)) {
              // Render every page to PNG and replace the <img> with a stack of images
              const pdfDoc = await pdfjsLib.getDocument({ data: buffer })
                .promise;
              const pageImgs: string[] = [];
              for (let p = 1; p <= pdfDoc.numPages; p++) {
                const page = await pdfDoc.getPage(p);
                const viewport = page.getViewport({ scale: 2 }); // 2× for print quality
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({
                  canvasContext: canvas.getContext("2d")!,
                  viewport,
                  canvas,
                }).promise;
                pageImgs.push(canvas.toDataURL("image/png"));
              }
              const replacement = pageImgs
                .map(
                  (dataUrl, i) =>
                    `<img src="${dataUrl}" alt="PDF page ${i + 1}" style="max-width:100%;display:block;margin:0 0 8px;" />`,
                )
                .join("\n");
              html = html.replace(m[0], replacement);
            } else {
              const mimeType = resp.headers.get("content-type") || "image/png";
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(buffer)),
              );
              const dataUrl = `data:${mimeType};base64,${base64}`;
              html = html.replace(m[0], m[0].replace(m[2], dataUrl));
            }
          } catch {
            // leave original src if fetch fails
          }
        }),
      );
    }

    // Render math with KaTeX MathML output (no CSS needed, natively supported in modern browsers).
    // Split on <pre>/<code> segments first so math inside code blocks is left untouched.
    const finalHtml = html
      .split(/(<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[^<]*<\/code>)/i)
      .map((seg, i) => {
        if (i % 2 === 1) return seg;
        seg = seg.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) =>
          katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
            output: "mathml",
          }),
        );
        seg = seg.replace(/\$([^\n$]+?)\$/g, (_, math) =>
          katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
            output: "mathml",
          }),
        );
        return seg;
      })
      .join("");

    const title = filename.replace(/\.md$/, "");
    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob: *;" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 32px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-weight: 700;
      line-height: 1.3;
      margin: 1.5em 0 0.5em;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
    h3 { font-size: 1.25em; }
    p { margin: 0 0 1em; }
    a { color: #2563eb; text-decoration: underline; }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.875em;
      background: #f3f4f6;
      padding: 0.15em 0.4em;
      border-radius: 3px;
    }
    pre {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 1em 1.25em;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; font-size: 0.875em; }
    blockquote {
      border-left: 4px solid #d1d5db;
      margin: 1em 0;
      padding: 0.5em 1em;
      color: #6b7280;
    }
    blockquote p { margin: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #d1d5db; padding: 0.5em 0.75em; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
    ul, ol { padding-left: 1.5em; margin: 0 0 1em; }
    li { margin: 0.25em 0; }
    .mermaid-diagram { text-align: center; margin: 1.5em 0; }
    .mermaid-diagram svg { max-width: 100%; height: auto; }
    math { font-size: 1.1em; }
    /* Prism default theme */
    code[class*=language-],pre[class*=language-]{color:#000;background:0 0;text-shadow:0 1px #fff;font-family:Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace;font-size:1em;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;word-wrap:normal;line-height:1.5;-moz-tab-size:4;-o-tab-size:4;tab-size:4;-webkit-hyphens:none;-moz-hyphens:none;-ms-hyphens:none;hyphens:none}
    pre[class*=language-]{padding:1em;margin:.5em 0;overflow:auto}:not(pre)>code[class*=language-],pre[class*=language-]{background:#f5f2f0}:not(pre)>code[class*=language-]{padding:.1em;border-radius:.3em;white-space:normal}.token.cdata,.token.comment,.token.doctype,.token.prolog{color:#708090}.token.punctuation{color:#999}.token.namespace{opacity:.7}.token.boolean,.token.constant,.token.deleted,.token.number,.token.property,.token.symbol,.token.tag{color:#905}.token.attr-name,.token.builtin,.token.char,.token.inserted,.token.selector,.token.string{color:#690}.language-css .token.string,.style .token.string,.token.entity,.token.operator,.token.url{color:#9a6e3a;background:hsla(0,0%,100%,.5)}.token.atrule,.token.attr-value,.token.keyword{color:#07a}.token.class-name,.token.function{color:#dd4a68}.token.important,.token.regex,.token.variable{color:#e90}.token.bold,.token.important{font-weight:700}.token.italic{font-style:italic}.token.entity{cursor:help}
    @page { margin: 0; }
    @media print {
      body { padding: 10mm 12mm; }
      a { color: #1a1a1a; }
      pre { white-space: pre-wrap; word-break: break-word; }
    }
  </style>
<script>window.onload = function() { window.print(); };</script>
</head>
<body>${finalHtml}</body>
</html>`;

    const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
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

  async exportDocumentsPlain() {
    const response = await fetch(`${API_URL}/api/documents/export-plain`, {
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
    a.download = `plumio-export-plain-${new Date().toISOString().slice(0, 10)}.tar.gz`;
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

  // Tags
  async listTags() {
    return this.request<{
      tags: Array<{
        id: number;
        name: string;
        color: string | null;
        description: string | null;
        created_at: string;
        updated_at: string;
        document_count: number;
      }>;
    }>("/api/tags");
  }

  async createTag(
    name: string,
    color?: string | null,
    description?: string | null,
  ) {
    return this.request<{
      tag: {
        id: number;
        name: string;
        color: string | null;
        description: string | null;
      };
    }>("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name, color, description }),
    });
  }

  async updateTag(
    id: number,
    data: { name?: string; color?: string | null; description?: string | null },
  ) {
    return this.request<{
      tag: {
        id: number;
        name: string;
        color: string | null;
        description: string | null;
      };
    }>(`/api/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: number) {
    return this.request(`/api/tags/${id}`, { method: "DELETE" });
  }

  async getDocumentTags(path: string) {
    return this.request<{
      tags: Array<{ id: number; name: string; color: string | null }>;
    }>(`/api/tags/document?path=${encodeURIComponent(path)}`);
  }

  async setDocumentTags(path: string, tagIds: number[]) {
    return this.request<{
      tags: Array<{ id: number; name: string; color: string | null }>;
    }>("/api/tags/document", {
      method: "POST",
      body: JSON.stringify({ path, tagIds }),
    });
  }

  async bulkTag(
    documentPaths: string[],
    tagId: number,
    action: "add" | "remove",
  ) {
    return this.request<{ message: string }>("/api/tags/bulk", {
      method: "POST",
      body: JSON.stringify({ documentPaths, tagId, action }),
    });
  }

  async getTagMappings() {
    return this.request<{ mappings: Record<string, number[]> }>(
      "/api/tags/mappings",
    );
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
export const exportDocumentsPlain = () => api.exportDocumentsPlain();
export const importDocuments = (file: File) => api.importDocuments(file);
