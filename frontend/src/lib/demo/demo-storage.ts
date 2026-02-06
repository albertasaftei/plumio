// Demo storage using localStorage with seeding pattern from Papra

const DEMO_PREFIX = "plumio_demo:";
const DEMO_SEEDED_KEY = `${DEMO_PREFIX}seeded`;
const DEMO_DOCS_KEY = `${DEMO_PREFIX}documents`;
const DEMO_USER_KEY = `${DEMO_PREFIX}user`;
const DEMO_ORG_KEY = `${DEMO_PREFIX}org`;
const DEMO_FOLDER_COLORS_KEY = `${DEMO_PREFIX}folder_colors`;
const DEMO_FOLDER_FAVORITES_KEY = `${DEMO_PREFIX}folder_favorites`;
const DEMO_FOLDERS_KEY = `${DEMO_PREFIX}folders`;

interface StoredDocument {
  path: string;
  content: string;
  modified: string;
  size: number;
  color?: string;
  favorite?: boolean;
  archived?: boolean;
  archived_at?: string;
  deleted?: boolean;
  deleted_at?: string;
}

// Simple in-memory lock to prevent concurrent seeding
let seedingPromise: Promise<void> | null = null;

export async function ensureDemoSeeded(): Promise<void> {
  // Only run in browser
  if (typeof window === "undefined") {
    return;
  }

  // If already seeded, return immediately
  if (localStorage.getItem(DEMO_SEEDED_KEY) === "true") {
    return;
  }

  // If seeding is in progress, wait for it
  if (seedingPromise) {
    return seedingPromise;
  }

  // Start seeding
  seedingPromise = (async () => {
    const { sampleDocuments, demoUser, demoOrg, sampleFolderColors } =
      await import("./demo-seed");

    // Seed user data
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    localStorage.setItem(DEMO_ORG_KEY, JSON.stringify(demoOrg));
    localStorage.setItem("plumio_current_org", JSON.stringify(demoOrg));
    localStorage.setItem("plumio_token", "demo-token");
    localStorage.setItem(
      DEMO_FOLDER_COLORS_KEY,
      JSON.stringify(sampleFolderColors),
    );

    // Seed documents
    const docs: StoredDocument[] = sampleDocuments.map((doc) => ({
      ...doc,
      size: doc.content.length,
    }));
    localStorage.setItem(DEMO_DOCS_KEY, JSON.stringify(docs));

    // Mark as seeded
    localStorage.setItem(DEMO_SEEDED_KEY, "true");
  })().finally(() => {
    seedingPromise = null;
  });

  return seedingPromise;
}

export function clearDemoStorage(): void {
  if (typeof window === "undefined") return;

  // Clear all demo keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DEMO_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  // Also clear the token
  localStorage.removeItem("plumio_token");
  localStorage.removeItem("plumio_current_org");
}

export function getDemoDocuments(): StoredDocument[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(DEMO_DOCS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveDemoDocuments(docs: StoredDocument[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_DOCS_KEY, JSON.stringify(docs));
}

export function getDemoUser() {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(DEMO_USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function getDemoOrg() {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(DEMO_ORG_KEY);
  return data ? JSON.parse(data) : null;
}

export function getFolderColors(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const data = localStorage.getItem(DEMO_FOLDER_COLORS_KEY);
  return data ? JSON.parse(data) : {};
}

export function setFolderColor(path: string, color: string | null): void {
  if (typeof window === "undefined") return;
  const colors = getFolderColors();
  if (color) {
    colors[path] = color;
  } else {
    delete colors[path];
  }
  localStorage.setItem(DEMO_FOLDER_COLORS_KEY, JSON.stringify(colors));
}

export function getFolderColor(path: string): string | undefined {
  const colors = getFolderColors();
  return colors[path];
}

export function getCreatedFolders(): string[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(DEMO_FOLDERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addCreatedFolder(path: string): void {
  if (typeof window === "undefined") return;
  const folders = getCreatedFolders();
  if (!folders.includes(path)) {
    folders.push(path);
    localStorage.setItem(DEMO_FOLDERS_KEY, JSON.stringify(folders));
  }
}

export function removeCreatedFolder(path: string): void {
  if (typeof window === "undefined") return;
  const folders = getCreatedFolders();
  const filtered = folders.filter(
    (f) => f !== path && !f.startsWith(path + "/"),
  );
  localStorage.setItem(DEMO_FOLDERS_KEY, JSON.stringify(filtered));
}

export function getFolderFavorites(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  const data = localStorage.getItem(DEMO_FOLDER_FAVORITES_KEY);
  return data ? JSON.parse(data) : {};
}

export function setFolderFavorite(path: string, favorite: boolean): void {
  if (typeof window === "undefined") return;
  const favorites = getFolderFavorites();
  if (favorite) {
    favorites[path] = true;
  } else {
    delete favorites[path];
  }
  localStorage.setItem(DEMO_FOLDER_FAVORITES_KEY, JSON.stringify(favorites));
}

export function getFolderFavorite(path: string): boolean {
  const favorites = getFolderFavorites();
  return favorites[path] || false;
}
