/**
 * Document Store
 *
 * Deep module that owns all document state for the active session. Provides a
 * narrow interface: one signal to read documents, one function to load them,
 * and typed mutation functions. Mutations update local state immediately
 * (optimistic) and confirm with the server — eliminating the full-tree refetch
 * that previously followed every operation.
 *
 * Instantiated once by AppLayout and exposed via AppLayoutContext.
 */

import { createSignal } from "solid-js";
import { api, type Document } from "./api";

export type ReorderOp = "reorder-before" | "reorder-after" | "make-child";

export function createDocumentStore() {
  const [documents, setDocuments] = createSignal<Document[]>([]);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = async (): Promise<void> => {
    const result = await api.listAllDocuments();
    setDocuments(result.items);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Remove a path and all of its descendants from local state. */
  const removeSubtree = (path: string) => {
    setDocuments((docs) =>
      docs.filter((d) => d.path !== path && !d.path.startsWith(path + "/")),
    );
  };

  /** Apply a path prefix rename across all matching documents. */
  const renamePrefix = (oldPrefix: string, newPrefix: string) => {
    setDocuments((docs) =>
      docs.map((d) => {
        if (d.path === oldPrefix) {
          return {
            ...d,
            path: newPrefix,
            name: newPrefix.split("/").pop()?.replace(/\.md$/, "") ?? d.name,
          };
        }
        if (d.path.startsWith(oldPrefix + "/")) {
          return { ...d, path: newPrefix + d.path.slice(oldPrefix.length) };
        }
        return d;
      }),
    );
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const createDocument = async (
    name: string,
    folder: string,
  ): Promise<{ path: string }> => {
    const result = await api.saveDocument(
      "",
      "# New Document\n\nStart writing...",
      true,
      folder,
      name,
    );
    // Add new document to local state without refetch
    setDocuments((docs) => [
      ...docs,
      {
        name: result.path.split("/").pop()?.replace(/\.md$/, "") ?? name,
        path: result.path,
        type: "file" as const,
        modified: new Date().toISOString(),
        size: 0,
        sort_order: 0,
      },
    ]);
    return { path: result.path };
  };

  const createFolder = async (
    name: string,
    parent: string,
  ): Promise<{ path: string }> => {
    const result = (await api.createFolder("", parent, name)) as {
      path: string;
    };
    setDocuments((docs) => [
      ...docs,
      {
        name,
        path: result.path,
        type: "folder" as const,
        modified: new Date().toISOString(),
        size: 0,
        sort_order: 0,
      },
    ]);
    return { path: result.path };
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteItem = async (path: string): Promise<void> => {
    const snapshot = documents();
    removeSubtree(path);
    try {
      await api.deleteItem(path);
    } catch (error) {
      setDocuments(snapshot);
      throw error;
    }
  };

  const bulkDelete = async (paths: string[]): Promise<void> => {
    const snapshot = documents();
    setDocuments((docs) =>
      docs.filter(
        (d) => !paths.some((p) => d.path === p || d.path.startsWith(p + "/")),
      ),
    );
    try {
      await api.bulkDeleteItems(paths);
    } catch (error) {
      setDocuments(snapshot);
      throw error;
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────

  const archiveItem = async (path: string): Promise<void> => {
    const snapshot = documents();
    removeSubtree(path);
    try {
      await api.archiveDocument(path);
    } catch (error) {
      setDocuments(snapshot);
      throw error;
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────

  const renameItem = async (
    oldPath: string,
    newName: string,
  ): Promise<{ newPath: string }> => {
    const snapshot = documents();

    // Predict the new path for immediate feedback
    const parts = oldPath.split("/");
    const isFile = parts[parts.length - 1].includes(".");
    const finalName =
      isFile && !newName.endsWith(".md") ? `${newName}.md` : newName;
    const predictedNewPath =
      [...parts.slice(0, -1), finalName].join("/") || `/${finalName}`;

    renamePrefix(oldPath, predictedNewPath);

    try {
      const result = await api.renameItem(oldPath, newName);
      // Server may sanitize the name differently — reconcile
      if (result.newPath !== predictedNewPath) {
        renamePrefix(predictedNewPath, result.newPath);
      }
      return result;
    } catch (error) {
      setDocuments(snapshot);
      throw error;
    }
  };

  // ── Move ──────────────────────────────────────────────────────────────────

  const moveItem = async (
    sourcePath: string,
    destFolder: string,
    targetOrgId?: number,
    keepSource?: boolean,
  ): Promise<{ newPath?: string }> => {
    if (targetOrgId !== undefined) {
      const snapshot = documents();
      if (!keepSource) {
        removeSubtree(sourcePath);
      }
      try {
        return await api.moveCrossOrg(sourcePath, targetOrgId, keepSource);
      } catch (error) {
        setDocuments(snapshot);
        throw error;
      }
    }

    const itemName = sourcePath.split("/").pop()!;
    const newPath =
      destFolder === "/" ? `/${itemName}` : `${destFolder}/${itemName}`;

    if (newPath === sourcePath) return { newPath };

    const snapshot = documents();
    renamePrefix(sourcePath, newPath);

    try {
      const result = await api.moveItem(sourcePath, destFolder);
      // Reconcile if server returned a different path
      if (result.newPath !== newPath) {
        renamePrefix(newPath, result.newPath);
      }
      return result;
    } catch (error) {
      setDocuments(snapshot);
      throw error;
    }
  };

  // ── Color ─────────────────────────────────────────────────────────────────

  const setItemColor = async (
    path: string,
    color: string | null,
  ): Promise<void> => {
    const prev = documents().find((d) => d.path === path)?.color;
    setDocuments((docs) =>
      docs.map((d) =>
        d.path === path ? { ...d, color: color ?? undefined } : d,
      ),
    );
    try {
      await api.setItemColor(path, color);
    } catch (error) {
      // Revert to previous color
      setDocuments((docs) =>
        docs.map((d) => (d.path === path ? { ...d, color: prev } : d)),
      );
      throw error;
    }
  };

  // ── Favorite ──────────────────────────────────────────────────────────────

  const toggleFavorite = async (
    path: string,
    favorite: boolean,
  ): Promise<void> => {
    setDocuments((docs) =>
      docs.map((d) => (d.path === path ? { ...d, favorite } : d)),
    );
    try {
      await api.toggleFavorite(path, favorite);
    } catch (error) {
      setDocuments((docs) =>
        docs.map((d) => (d.path === path ? { ...d, favorite: !favorite } : d)),
      );
      throw error;
    }
  };

  // ── Duplicate ─────────────────────────────────────────────────────────────

  const duplicateItem = async (path: string): Promise<void> => {
    const result = await api.duplicateItem(path);
    if (result.newPath) {
      const original = documents().find((d) => d.path === path);
      setDocuments((docs) => [
        ...docs,
        {
          ...(original ?? {
            type: "file" as const,
            modified: new Date().toISOString(),
            size: 0,
            sort_order: 0,
          }),
          path: result.newPath,
          name:
            result.newPath.split("/").pop()?.replace(/\.md$/, "") ??
            original?.name ??
            "",
        },
      ]);
    }
  };

  // ── Reorder ───────────────────────────────────────────────────────────────

  /**
   * Reorder delegates to the server because sort_order updates affect siblings
   * in ways that are hard to predict locally. After the API call resolves, a
   * full load is performed to get accurate sort_order values.
   */
  const reorderItem = async (
    sourcePath: string,
    targetPath: string,
    operation: ReorderOp,
  ): Promise<{ newPath?: string }> => {
    const result = await api.reorderItem(sourcePath, targetPath, operation);
    // Server may have moved the file (make-child) — update path, then reload
    // for accurate sort_order on all siblings
    if (result.newPath && result.newPath !== sourcePath) {
      renamePrefix(sourcePath, result.newPath);
    }
    await load();
    return result;
  };

  return {
    documents,
    load,
    createDocument,
    createFolder,
    deleteItem,
    bulkDelete,
    archiveItem,
    renameItem,
    moveItem,
    setItemColor,
    toggleFavorite,
    duplicateItem,
    reorderItem,
  };
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;
