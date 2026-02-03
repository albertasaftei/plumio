// Demo API client - mocks backend API using localStorage

import {
  ensureDemoSeeded,
  getDemoDocuments,
  saveDemoDocuments,
  getDemoUser,
  getDemoOrg,
  setFolderColor as setFolderColorStorage,
  getFolderColor as getFolderColorStorage,
  getCreatedFolders,
  addCreatedFolder,
  removeCreatedFolder,
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

    // Add explicitly created folders in this directory
    const createdFolders = getCreatedFolders();
    createdFolders.forEach((folderPath) => {
      const lastSlash = folderPath.lastIndexOf("/");
      const parentPath =
        lastSlash > 0 ? folderPath.substring(0, lastSlash) : "/";
      if (parentPath === path) {
        folders.add(folderPath);
      }
    });

    folders.forEach((folderPath) => {
      const folderName = folderPath.split("/").pop() || folderPath;
      const folderColor = getFolderColorStorage(folderPath);
      items.push({
        name: folderName,
        path: folderPath,
        type: "folder",
        modified: new Date().toISOString(),
        size: 0,
        ...(folderColor && { color: folderColor }),
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
    return { content: doc.content, path: doc.path };
  },

  async saveDocument(path: string, content: string, isNew: boolean = false) {
    await ensureReady();
    const docs = getDemoDocuments();

    if (isNew) {
      const newDoc = {
        path,
        content,
        modified: new Date().toISOString(),
        size: content.length,
      };
      docs.push(newDoc);
      saveDemoDocuments(docs);
      return { message: "Document created", path };
    } else {
      const doc = docs.find((d) => d.path === path && !d.deleted);
      if (!doc) throw new Error("Document not found");

      doc.content = content;
      doc.modified = new Date().toISOString();
      doc.size = content.length;

      saveDemoDocuments(docs);
      return { message: "Document saved", path };
    }
  },

  async createFolder(path: string) {
    await ensureReady();
    // Store this folder so it persists even when empty
    addCreatedFolder(path);
    return { message: "Folder created", path };
  },

  async deleteItem(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path);

    if (doc) {
      // It's a file
      doc.deleted = true;
      doc.deleted_at = new Date().toISOString();
      saveDemoDocuments(docs);
    } else {
      // It's a folder - delete all documents inside it
      let deletedCount = 0;
      docs.forEach((d) => {
        if (d.path === path || d.path.startsWith(path + "/")) {
          d.deleted = true;
          d.deleted_at = new Date().toISOString();
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        saveDemoDocuments(docs);
      }

      // Remove folder from created folders list and its color
      removeCreatedFolder(path);
      setFolderColorStorage(path, null);
    }

    return { message: "Item deleted", path };
  },

  async renameItem(oldPath: string, newPath: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === oldPath && !d.deleted);

    if (!doc) throw new Error("Document not found");

    doc.path = newPath;
    doc.modified = new Date().toISOString();

    saveDemoDocuments(docs);
    return { message: "Item renamed", path: newPath };
  },

  async setItemColor(path: string, color: string | null) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);

    if (doc) {
      // It's a file
      if (color) {
        doc.color = color;
      } else {
        delete doc.color;
      }
      saveDemoDocuments(docs);
    } else {
      // It's a folder (virtual) - store color separately
      setFolderColorStorage(path, color);
    }

    return { message: "Color updated", path };
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

  async unarchiveDocument(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);

    if (!doc) throw new Error("Document not found");

    doc.archived = false;
    doc.archived_at = undefined;

    saveDemoDocuments(docs);
    return { message: "Document unarchived", path };
  },

  async listArchivedDocuments() {
    await ensureReady();
    const docs = getDemoDocuments();
    return { items: docs.filter((d) => d.archived && !d.deleted) };
  },

  async listDeletedDocuments() {
    await ensureReady();
    const docs = getDemoDocuments();
    return { items: docs.filter((d) => d.deleted) };
  },

  async restoreDeletedDocument(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path);

    if (!doc) throw new Error("Document not found");

    doc.deleted = false;
    doc.deleted_at = undefined;

    saveDemoDocuments(docs);
    return { message: "Document restored", path };
  },

  async permanentlyDeleteFromTrash(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const index = docs.findIndex((d) => d.path === path);

    if (index === -1) throw new Error("Document not found");

    docs.splice(index, 1);
    saveDemoDocuments(docs);
    return { message: "Document permanently deleted", path };
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
  async getCurrentOrganization() {
    await ensureReady();
    if (typeof window === "undefined") return null;

    const orgStr = localStorage.getItem("plumio_current_org");
    if (orgStr) {
      try {
        return JSON.parse(orgStr);
      } catch {
        // If parsing fails, return the demo org
        return getDemoOrg();
      }
    }
    return getDemoOrg();
  },

  async isOrgAdmin() {
    await ensureReady();
    // In demo mode, user is always admin
    return true;
  },

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

  async listOrgMembers(orgId: number) {
    await ensureReady();
    const user = getDemoUser();

    return {
      members: [
        {
          id: 1,
          username: user.username,
          email: user.email,
          role: "admin",
          joinedAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        },
      ],
    };
  },

  async listUsers() {
    await ensureReady();
    const user = getDemoUser();

    return {
      users: [
        {
          id: 1,
          username: user.username,
          email: user.email,
          createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
          isAdmin: false,
        },
      ],
    };
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

  // Export/Import
  async exportDocuments() {
    await ensureReady();
    const docs = getDemoDocuments().filter((d) => !d.deleted && !d.archived);

    // Create a JSON export of all documents
    const exportData = {
      exported_at: new Date().toISOString(),
      documents: docs.map((d) => ({
        path: d.path,
        content: d.content,
        modified: d.modified,
        color: d.color,
      })),
    };

    // Convert to JSON and create a blob
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });

    // Trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pluma-demo-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async importDocuments(file: File) {
    await ensureReady();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const importData = JSON.parse(content);

          if (!importData.documents || !Array.isArray(importData.documents)) {
            throw new Error("Invalid import file format");
          }

          const docs = getDemoDocuments();
          let importedCount = 0;

          // Add imported documents
          importData.documents.forEach((importDoc: any) => {
            // Check if document already exists
            const existing = docs.find((d) => d.path === importDoc.path);
            if (!existing) {
              docs.push({
                path: importDoc.path,
                content: importDoc.content,
                modified: new Date().toISOString(),
                size: importDoc.content.length,
                color: importDoc.color,
              });
              importedCount++;
            }
          });

          saveDemoDocuments(docs);
          resolve({
            message: `Successfully imported ${importedCount} documents`,
            imported: importedCount,
          });
        } catch (error) {
          reject(new Error("Failed to parse import file"));
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },
};
