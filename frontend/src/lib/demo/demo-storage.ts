// Demo storage using localStorage with seeding pattern from Papra

const DEMO_PREFIX = "plumio_demo:";
const DEMO_SEEDED_KEY = `${DEMO_PREFIX}seeded`;
const DEMO_DOCS_KEY = `${DEMO_PREFIX}documents`;
const DEMO_USER_KEY = `${DEMO_PREFIX}user`;
const DEMO_ORG_KEY = `${DEMO_PREFIX}org`;

interface StoredDocument {
  path: string;
  content: string;
  modified: string;
  size: number;
  color?: string;
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
    const { sampleDocuments, demoUser, demoOrg } = await import("./demo-seed");

    // Seed user data
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    localStorage.setItem(DEMO_ORG_KEY, JSON.stringify(demoOrg));

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
