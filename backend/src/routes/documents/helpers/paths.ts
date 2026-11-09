import path from "path";
import { constants as fsConstants } from "fs";
import fs from "fs/promises";

export const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";

// Get organization-specific documents path
export function getOrgDocumentsPath(organizationId: number): string {
  return path.resolve(DOCUMENTS_PATH, `org-${organizationId}`);
}

export async function writeFileNoFollow(
  filePath: string,
  contents: string | Buffer,
  encoding?: BufferEncoding,
): Promise<void> {
  try {
    const stats = await fs.lstat(filePath);
    if (stats.isSymbolicLink()) {
      throw new Error("Symbolic link destinations are not allowed");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const handle = await fs.open(
    filePath,
    fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_TRUNC |
      (fsConstants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    if (typeof contents === "string" && encoding) {
      await handle.writeFile(contents, encoding);
    } else {
      await handle.writeFile(contents);
    }
  } finally {
    await handle.close();
  }
}

function getSafePathSegments(userPath: string): string[] {
  if (!userPath || userPath.includes("\0")) {
    if (userPath === "") return [];
    throw new Error("Invalid document path");
  }

  const normalized = userPath.replace(/\\/g, "/");
  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new Error("Invalid document path");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Path escapes organization directory");
  }
  return segments;
}

export async function resolveOrgPath(
  userPath: string,
  organizationId: number,
): Promise<string> {
  const orgPath = path.resolve(getOrgDocumentsPath(organizationId));
  await fs.mkdir(path.dirname(orgPath), { recursive: true });
  try {
    await fs.mkdir(orgPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  const rootStat = await fs.lstat(orgPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Organization document root is not a real directory");
  }
  const canonicalRoot = await fs.realpath(orgPath);
  const segments = getSafePathSegments(userPath);
  const resolved = path.resolve(canonicalRoot, ...segments);
  const relative = path.relative(canonicalRoot, resolved);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Path escapes organization directory");
  }

  let currentPath = canonicalRoot;
  for (let index = 0; index < segments.length; index++) {
    currentPath = path.join(currentPath, segments[index]);
    let stats;
    try {
      stats = await fs.lstat(currentPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }

    if (stats.isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed in document paths");
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new Error("A document path ancestor is not a directory");
    }

    const canonicalPath = await fs.realpath(currentPath);
    const canonicalRelative = path.relative(canonicalRoot, canonicalPath);
    if (
      canonicalRelative === ".." ||
      canonicalRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(canonicalRelative)
    ) {
      throw new Error("Path escapes organization directory");
    }
  }

  return resolved;
}

// Sanitize a filename segment so it is safe on every OS.
// - Replaces forward and back slashes (path separators on any OS) with a dash
//   so user-typed names like "01/04/2026" or Windows paths like "foo\\bar"
//   never create unintended subdirectories.
// - Strips Windows-reserved characters (< > : " | ? *) that would cause
//   fs.writeFile to fail or behave unexpectedly on Windows.
// - Trims surrounding whitespace / dots (Windows rejects trailing dots/spaces).
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\]/g, "-") // forward + back slashes → dash
    .replace(/[<>:"|?*]/g, "-") // Windows-reserved chars  → dash
    .replace(/[\x00-\x1f\x7f]/g, "") // control characters      → strip
    .trim() // surrounding whitespace  → strip
    .replace(/[.\s]+$/, ""); // trailing dots / spaces  → strip
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

  const fullPath = await resolveOrgPath(basePath, organizationId);

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
  const nameWithoutExt = ext ? filename.slice(0, -ext.length) : filename;

  // Try with incrementing counter until we find a unique name
  let counter = 1;
  while (true) {
    const newName = `${nameWithoutExt} (${counter})${ext}`;
    const newPath =
      dir === "." || dir === "/" ? `/${newName}` : `${dir}/${newName}`;
    const newFullPath = await resolveOrgPath(newPath, organizationId);

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
  const fullPath = await resolveOrgPath(basePath, organizationId);

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
    const newFullPath = await resolveOrgPath(newPath, organizationId);

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
