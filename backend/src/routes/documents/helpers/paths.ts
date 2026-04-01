import path from "path";
import fs from "fs/promises";

export const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";

// Get organization-specific documents path
export function getOrgDocumentsPath(organizationId: number): string {
  return path.join(DOCUMENTS_PATH, `org-${organizationId}`);
}

// Sanitize path to prevent directory traversal
export function sanitizePath(userPath: string, organizationId: number): string {
  const normalized = path.normalize(userPath).replace(/^(\.\.[\/\\])+/, "");
  const orgPath = getOrgDocumentsPath(organizationId);
  return path.join(orgPath, normalized);
}

// Sanitize a filename segment — replaces slashes so user-typed names
// (e.g. dates like "01/04/2026") never create unintended subdirectories.
export function sanitizeFilename(name: string): string {
  return name.replace(/\//g, "-");
}

// Generate unique file path by appending (1), (2), etc. if file already exists
export async function getUniqueFilePath(
  basePath: string,
  organizationId: number,
  isNewDocument: boolean = false,
): Promise<string> {
  // If not a new document, return the path as-is
  if (!isNewDocument) {
    return basePath;
  }

  const orgPath = getOrgDocumentsPath(organizationId);
  const fullPath = path.join(orgPath, basePath);

  // Check if file exists
  try {
    await fs.access(fullPath);
    // File exists, need to generate unique name
  } catch {
    // File doesn't exist, can use the original path
    return basePath;
  }

  // Parse the path to extract directory, filename, and extension
  const dir = path.dirname(basePath);
  const filename = path.basename(basePath);
  const ext = path.extname(filename);
  const nameWithoutExt = filename.slice(0, -ext.length);

  // Try with incrementing counter until we find a unique name
  let counter = 1;
  while (true) {
    const newName = `${nameWithoutExt} (${counter})${ext}`;
    const newPath = dir === "/" ? `/${newName}` : `${dir}/${newName}`;
    const newFullPath = path.join(orgPath, newPath);

    try {
      await fs.access(newFullPath);
      // File exists, try next counter
      counter++;
    } catch {
      // File doesn't exist, we can use this path
      return newPath;
    }
  }
}

// Generate unique folder path by appending (1), (2), etc. if folder already exists
export async function getUniqueFolderPath(
  basePath: string,
  organizationId: number,
): Promise<string> {
  const orgPath = getOrgDocumentsPath(organizationId);
  const fullPath = path.join(orgPath, basePath);

  try {
    await fs.access(fullPath);
    // Folder exists, need to generate unique name
  } catch {
    return basePath;
  }

  const dir = path.dirname(basePath);
  const folderName = path.basename(basePath);

  let counter = 1;
  while (true) {
    const newName = `${folderName} (${counter})`;
    const newPath =
      dir === "." || dir === "/" ? `/${newName}` : `${dir}/${newName}`;
    const newFullPath = path.join(orgPath, newPath);

    try {
      await fs.access(newFullPath);
      counter++;
    } catch {
      return newPath;
    }
  }
}

export async function ensureOrgDirectoryExists(
  organizationId: number,
): Promise<void> {
  const orgPath = getOrgDocumentsPath(organizationId);
  try {
    await fs.access(orgPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(orgPath, { recursive: true });
  }
}
