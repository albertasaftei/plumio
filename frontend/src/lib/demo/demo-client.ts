// Demo API client - mocks backend API using localStorage

import {
  ensureDemoSeeded,
  getDemoDocuments,
  saveDemoDocuments,
  getDemoUser,
  getDemoOrg,
} from "./demo-storage";

// Ensure seeded before any operation
async function ensureReady() {
  await ensureDemoSeeded();
}

export const demoClient = {
  // Auth
  async checkSetup() {
    await ensureReady();
    // Demo mode doesn't need setup
    return { needsSetup: false };
  },

  async setup(username: string, email: string, password: string) {
    await ensureReady();
    // Demo mode doesn't support setup
    throw new Error("Setup not available in demo mode");
  },

  async login(username: string, password: string) {
    await ensureReady();
    const user = getDemoUser();
    const org = getDemoOrg();

    // Set fake token
    localStorage.setItem("plumio_token", "demo-token");
    localStorage.setItem("plumio_current_org", String(org.id));

    return { user, token: "demo-token" };
  },

  async logout() {
    localStorage.removeItem("plumio_token");
    localStorage.removeItem("plumio_current_org");
  },

  async validateSession() {
    await ensureReady();
    const token = localStorage.getItem("plumio_token");
    if (!token) throw new Error("No session");

    const user = getDemoUser();
    const org = getDemoOrg();
    return { user, orgs: [org] };
  },

  async register(email: string, username: string, password: string) {
    await ensureReady();
    return this.login(username, password);
  },

  async listOrganizations() {
    await ensureReady();
    const org = getDemoOrg();
    return { organizations: [org] };
  },

  async switchOrganization(orgId: number) {
    await ensureReady();
    const org = getDemoOrg();
    if (org.id !== orgId) throw new Error("Organization not found");
    localStorage.setItem("plumio_current_org", String(org.id));
  },

  // Documents - List format
  async listDocuments(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();

    // Filter documents that are in this directory (not deleted)
    const items: Array<{
      name: string;
      path: string;
      type: "file" | "folder";
      modified: string;
      size: number;
      color?: string;
      archived_at?: string;
    }> = docs
      .filter((d) => {
        if (d.deleted) return false;

        // Get parent path
        const lastSlash = d.path.lastIndexOf("/");
        const parentPath = lastSlash > 0 ? d.path.substring(0, lastSlash) : "/";

        return parentPath === path;
      })
      .map((d) => ({
        name: d.path.split("/").pop() || d.path,
        path: d.path,
        type: "file" as const,
        modified: d.modified,
        size: d.size,
        color: d.color,
        archived_at: d.archived_at,
      }));

    // Add folders (extract unique parent directories)
    const folders = new Set<string>();
    docs
      .filter((d) => !d.deleted)
      .forEach((d) => {
        const parts = d.path.split("/").filter(Boolean);
        if (parts.length > 1) {
          const currentDepth =
            path === "/" ? 0 : path.split("/").filter(Boolean).length;
          if (parts.length > currentDepth + 1) {
            const folderPath = "/" + parts.slice(0, currentDepth + 1).join("/");
            folders.add(folderPath);
          }
        }
      });

    folders.forEach((folderPath) => {
      const folderName = folderPath.split("/").pop() || folderPath;
      items.push({
        name: folderName,
        path: folderPath,
        type: "folder",
        modified: new Date().toISOString(),
        size: 0,
      });
    });

    return { items };
  },
  async getAllDocuments() {
    await ensureReady();
    const docs = getDemoDocuments();
    return docs.filter((d) => !d.deleted);
  },

  async getDocument(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);
    if (!doc) throw new Error("Document not found");
    return doc;
  },

  async createDocument(path: string, content: string) {
    await ensureReady();
    const docs = getDemoDocuments();

    const newDoc = {
      path,
      content,
      modified: new Date().toISOString(),
      size: content.length,
    };

    docs.push(newDoc);
    saveDemoDocuments(docs);
    return newDoc;
  },

  async updateDocument(path: string, content: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);

    if (!doc) throw new Error("Document not found");

    doc.content = content;
    doc.modified = new Date().toISOString();
    doc.size = content.length;

    saveDemoDocuments(docs);
    return doc;
  },

  async renameDocument(oldPath: string, newPath: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === oldPath && !d.deleted);

    if (!doc) throw new Error("Document not found");

    doc.path = newPath;
    doc.modified = new Date().toISOString();

    saveDemoDocuments(docs);
    return doc;
  },

  async deleteDocument(path: string, permanent = false) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path);

    if (!doc) throw new Error("Document not found");

    if (permanent) {
      const index = docs.indexOf(doc);
      docs.splice(index, 1);
    } else {
      doc.deleted = true;
      doc.deleted_at = new Date().toISOString();
    }

    saveDemoDocuments(docs);
  },

  async archiveDocument(path: string, archive = true) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);

    if (!doc) throw new Error("Document not found");

    doc.archived = archive;
    doc.archived_at = archive ? new Date().toISOString() : undefined;

    saveDemoDocuments(docs);
    return doc;
  },

  async restoreDocument(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path);

    if (!doc) throw new Error("Document not found");

    doc.deleted = false;
    doc.deleted_at = undefined;

    saveDemoDocuments(docs);
    return doc;
  },

  async updateDocumentColor(path: string, color: string | null) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);

    if (!doc) throw new Error("Document not found");

    if (color) {
      doc.color = color;
    } else {
      delete doc.color;
    }

    saveDemoDocuments(docs);
    return doc;
  },

  // Organizations
  async getOrganization() {
    await ensureReady();
    return getDemoOrg();
  },

  async getOrganizationMembers() {
    await ensureReady();
    const user = getDemoUser();
    return [
      {
        username: user.username,
        email: user.email,
        role: "admin",
        joined_at: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
      },
    ];
  },

  // Trash
  async getTrash() {
    await ensureReady();
    const docs = getDemoDocuments();
    return docs.filter((d) => d.deleted);
  },

  async emptyTrash() {
    await ensureReady();
    const docs = getDemoDocuments();
    const filtered = docs.filter((d) => !d.deleted);
    saveDemoDocuments(filtered);
  },
};
