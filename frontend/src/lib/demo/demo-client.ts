// Demo API client - mocks backend API using localStorage

import {
  ensureDemoSeeded,
  getDemoDocuments,
  saveDemoDocuments,
  getDemoUser,
  getDemoOrg,
  setFolderColor as setFolderColorStorage,
  getFolderColor as getFolderColorStorage,
  setFolderFavorite as setFolderFavoriteStorage,
  getFolderFavorite as getFolderFavoriteStorage,
  getCreatedFolders,
  addCreatedFolder,
  removeCreatedFolder,
} from "./demo-storage";

// Ensure seeded before any operation
async function ensureReady() {
  await ensureDemoSeeded();
}

// Generate a unique path by appending (1), (2), etc. if the path already exists
function getUniquePath(
  basePath: string,
  existingPaths: string[],
  isFolder: boolean = false,
): string {
  if (!existingPaths.includes(basePath)) {
    return basePath;
  }

  const lastSlash = basePath.lastIndexOf("/");
  const dir = lastSlash > 0 ? basePath.substring(0, lastSlash) : "/";
  const filename = basePath.substring(lastSlash + 1);

  if (isFolder) {
    let counter = 1;
    while (true) {
      const newName = `${filename} (${counter})`;
      const newPath = dir === "/" ? `/${newName}` : `${dir}/${newName}`;
      if (!existingPaths.includes(newPath)) return newPath;
      counter++;
    }
  } else {
    const lastDot = filename.lastIndexOf(".");
    const ext = lastDot > 0 ? filename.substring(lastDot) : "";
    const nameWithoutExt =
      lastDot > 0 ? filename.substring(0, lastDot) : filename;

    let counter = 1;
    while (true) {
      const newName = `${nameWithoutExt} (${counter})${ext}`;
      const newPath = dir === "/" ? `/${newName}` : `${dir}/${newName}`;
      if (!existingPaths.includes(newPath)) return newPath;
      counter++;
    }
  }
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
      favorite?: boolean;
      archived_at?: string;
      sort_order: number;
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
        favorite: d.favorite || false,
        archived_at: d.archived_at,
        sort_order: 0,
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
      const folderFavorite = getFolderFavoriteStorage(folderPath);
      items.push({
        name: folderName,
        path: folderPath,
        type: "folder",
        modified: new Date().toISOString(),
        size: 0,
        ...(folderColor && { color: folderColor }),
        favorite: folderFavorite,
        sort_order: 0,
      });
    });

    return { items };
  },

  async listAllDocuments() {
    // In demo mode, recursively collect all documents using listDocuments
    const collect = async (path: string): Promise<any[]> => {
      const { items } = await this.listDocuments(path);
      const all: any[] = [];
      for (const item of items) {
        all.push(item);
        if (item.type === "folder") {
          const children = await collect(item.path);
          all.push(...children);
        }
      }
      return all;
    };
    const items = await collect("/");
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
      const existingPaths = docs.filter((d) => !d.deleted).map((d) => d.path);
      const uniquePath = getUniquePath(path, existingPaths, false);
      const newDoc = {
        path: uniquePath,
        content,
        modified: new Date().toISOString(),
        size: content.length,
      };
      docs.push(newDoc);
      saveDemoDocuments(docs);
      return { message: "Document created", path: uniquePath };
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
    const docs = getDemoDocuments();
    // Collect all known folder paths (explicit + implicit from document paths)
    const implicitFolders = new Set<string>();
    docs
      .filter((d) => !d.deleted)
      .forEach((d) => {
        const parts = d.path.split("/").filter(Boolean);
        for (let i = 1; i < parts.length; i++) {
          implicitFolders.add("/" + parts.slice(0, i).join("/"));
        }
      });
    const existingFolderPaths = [
      ...getCreatedFolders(),
      ...Array.from(implicitFolders),
    ];
    const uniquePath = getUniquePath(path, existingFolderPaths, true);
    addCreatedFolder(uniquePath);
    return { message: "Folder created", path: uniquePath };
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

  async moveItem(sourcePath: string, destinationFolder: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const itemName = sourcePath.split("/").pop() || sourcePath;
    const newPath =
      destinationFolder === "/"
        ? `/${itemName}`
        : `${destinationFolder}/${itemName}`;

    if (newPath === sourcePath) {
      return { message: "Item is already in the target location", newPath };
    }

    const isFile = docs.some((d) => d.path === sourcePath && !d.deleted);

    if (isFile) {
      const doc = docs.find((d) => d.path === sourcePath && !d.deleted);
      if (!doc) throw new Error("Document not found");
      doc.path = newPath;
      doc.modified = new Date().toISOString();
    } else {
      // It's a folder — update all documents inside it
      docs.forEach((d) => {
        if (
          !d.deleted &&
          (d.path === sourcePath || d.path.startsWith(sourcePath + "/"))
        ) {
          d.path = newPath + d.path.slice(sourcePath.length);
          d.modified = new Date().toISOString();
        }
      });

      // Update created folders list: rename the folder itself and any sub-folders
      const createdFolders = getCreatedFolders();
      createdFolders.forEach((fp) => {
        if (fp === sourcePath || fp.startsWith(sourcePath + "/")) {
          removeCreatedFolder(fp);
          addCreatedFolder(newPath + fp.slice(sourcePath.length));
        }
      });
    }

    saveDemoDocuments(docs);
    return { message: "Item moved", newPath };
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

  async toggleFavorite(path: string, favorite: boolean) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);

    if (doc) {
      // It's a file
      if (favorite) {
        doc.favorite = true;
      } else {
        delete doc.favorite;
      }
      saveDemoDocuments(docs);
    } else {
      // It's a folder (virtual) - store favorite separately
      setFolderFavoriteStorage(path, favorite);
    }

    return { message: "Favorite updated", path };
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

  async searchDocuments(query: string) {
    await ensureReady();
    const docs = getDemoDocuments().filter((d) => !d.deleted && !d.archived);
    const lower = query.toLowerCase();

    const results = docs
      .filter(
        (d) =>
          d.content?.toLowerCase().includes(lower) ||
          d.path.toLowerCase().includes(lower),
      )
      .map((d) => {
        // Build a simple snippet around the first match
        const rawContent = d.content || "";
        const escapedQuery = lower.replace(/[&<>"']/g, "");
        const idx = rawContent.toLowerCase().indexOf(lower);
        let snippet = "";
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(rawContent.length, idx + lower.length + 60);
          // Escape HTML in the slice before inserting mark tags
          const rawSlice = rawContent.slice(start, end);
          const escapedSlice = rawSlice
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const highlighted = escapedSlice.replace(
            new RegExp(escapedQuery, "gi"),
            (m) => `<mark>${m}</mark>`,
          );
          snippet =
            (start > 0 ? "..." : "") +
            highlighted +
            (end < rawContent.length ? "..." : "");
        }
        return {
          path: d.path,
          title: d.path.split("/").pop()?.replace(/\.md$/, "") ?? d.path,
          color: d.color ?? null,
          modified: d.modified ?? new Date().toISOString(),
          size: d.size ?? 0,
          snippet,
        };
      });

    return { results };
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
    a.download = `plumio-demo-export-${new Date().toISOString().slice(0, 10)}.json`;
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

  // Attachments (demo: stored as data URLs in localStorage)
  async uploadAttachment(documentPath: string, file: File) {
    await ensureReady();

    return new Promise<{
      message: string;
      filename: string;
      originalName: string;
      path: string;
      mimeType: string;
      size: number;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dataUrl = e.target?.result as string;
          const stored: any[] = JSON.parse(
            localStorage.getItem("plumio_demo_attachments") || "[]",
          );

          // Generate unique filename
          const ext =
            file.name.lastIndexOf(".") > 0
              ? file.name.substring(file.name.lastIndexOf("."))
              : "";
          const base =
            file.name.lastIndexOf(".") > 0
              ? file.name.substring(0, file.name.lastIndexOf("."))
              : file.name;
          let candidate = file.name;
          let counter = 1;
          const existingNames = stored.map((a: any) => a.filename);
          while (existingNames.includes(candidate)) {
            candidate = `${base} (${counter})${ext}`;
            counter++;
          }

          const id = Date.now();
          const orgId = 1;
          const relPath = `org-${orgId}/attachments/${candidate}`;

          stored.push({
            id,
            documentPath,
            filename: candidate,
            original_name: file.name,
            mime_type: file.type || "application/octet-stream",
            size: file.size,
            uploaded_at: new Date().toISOString(),
            path: relPath,
            dataUrl,
          });

          localStorage.setItem(
            "plumio_demo_attachments",
            JSON.stringify(stored),
          );

          resolve({
            message: "Attachment uploaded",
            filename: candidate,
            originalName: file.name,
            path: relPath,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  },

  async listAttachments(documentPath: string) {
    await ensureReady();
    const stored: any[] = JSON.parse(
      localStorage.getItem("plumio_demo_attachments") || "[]",
    );
    const attachments = stored
      .filter((a) => a.documentPath === documentPath)
      .map(({ dataUrl, ...rest }) => rest); // strip data URL from list response
    return { attachments };
  },

  async deleteAttachment(attachmentPath: string) {
    await ensureReady();
    const filename = attachmentPath.split("/").pop() || attachmentPath;
    const stored: any[] = JSON.parse(
      localStorage.getItem("plumio_demo_attachments") || "[]",
    );
    const filtered = stored.filter((a) => a.filename !== filename);
    localStorage.setItem("plumio_demo_attachments", JSON.stringify(filtered));
    return { message: "Attachment deleted" };
  },

  getAttachmentUrl(attachmentPath: string): string {
    const filename = attachmentPath.split("/").pop() || attachmentPath;
    const stored: any[] = JSON.parse(
      localStorage.getItem("plumio_demo_attachments") || "[]",
    );
    const entry = stored.find((a) => a.filename === filename);
    return entry?.dataUrl || "";
  },

  async reorderItem(
    sourcePath: string,
    targetPath: string,
    operation: "reorder-before" | "reorder-after" | "make-child",
  ) {
    await ensureReady();
    // Demo mode: make-child delegates to moveItem; reorder is a no-op (sort_order not persisted)
    if (operation === "make-child") {
      return this.moveItem(sourcePath, targetPath);
    }
    // Reordering in demo mode is visual-only (sort_order = 0 for all items)
    return { message: "Reordered" };
  },

  async checkVersion() {
    return { updateAvailable: false, latestVersion: null, releaseUrl: null };
  },

  async duplicateItem(path: string) {
    await ensureReady();
    const docs = getDemoDocuments();
    const doc = docs.find((d) => d.path === path && !d.deleted);
    if (!doc) throw new Error("Document not found");
    const ext = path.endsWith(".md") ? ".md" : "";
    const base = path.slice(0, path.length - ext.length);
    let newPath = `${base} (copy)${ext}`;
    let i = 2;
    while (docs.some((d) => d.path === newPath && !d.deleted)) {
      newPath = `${base} (copy ${i++})${ext}`;
    }
    docs.push({ ...doc, path: newPath, modified: new Date().toISOString() });
    saveDemoDocuments(docs);
    return { message: "Duplicated", newPath };
  },
};
