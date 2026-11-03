import fs from "fs/promises";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { extract } from "tar-stream";
import { hasAllowedExtension } from "./files.js";

export const MAX_IMPORT_COMPRESSED_BYTES = 50 * 1024 * 1024;

const MAX_IMPORT_EXPANDED_BYTES = 250 * 1024 * 1024;
const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 10_000;

export interface StagedImportFile {
  relativePath: string;
  stagedPath: string;
}

export class InvalidImportArchiveError extends Error {}

function getSafeRelativePath(name: string): string {
  if (
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    /^[a-zA-Z]:/.test(name)
  ) {
    throw new InvalidImportArchiveError("Archive contains an unsafe path");
  }

  const withoutDotPrefix = name.replace(/^(\.\/)+/, "");
  const trimmed = withoutDotPrefix.replace(/\/+$/, "");
  if (!trimmed) return "";

  const segments = trimmed.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith(".") ||
        /[<>:"|?*\x00-\x1f\x7f]/.test(segment) ||
        /[. ]$/.test(segment),
    )
  ) {
    throw new InvalidImportArchiveError("Archive contains an unsafe path");
  }

  return segments.join("/");
}

export async function extractImportArchive(
  archive: Buffer,
  stagingDirectory: string,
): Promise<StagedImportFile[]> {
  if (archive.byteLength > MAX_IMPORT_COMPRESSED_BYTES) {
    throw new InvalidImportArchiveError("Archive exceeds the compressed size limit");
  }

  const parser = extract();
  const explicitEntries = new Set<string>();
  const directories = new Set<string>();
  const files: StagedImportFile[] = [];
  let entryCount = 0;
  let expandedBytes = 0;

  parser.on("entry", (header, entry, next) => {
    void (async () => {
      entryCount++;
      if (entryCount > MAX_IMPORT_ENTRIES) {
        throw new InvalidImportArchiveError("Archive contains too many entries");
      }

      const relativePath = getSafeRelativePath(header.name);
      if (!relativePath && header.type === "directory") {
        next();
        return;
      }
      if (!relativePath || explicitEntries.has(relativePath)) {
        throw new InvalidImportArchiveError("Archive contains duplicate paths");
      }

      const segments = relativePath.split("/");
      for (let index = 1; index < segments.length; index++) {
        const parent = segments.slice(0, index).join("/");
        if (explicitEntries.has(parent) && !directories.has(parent)) {
          throw new InvalidImportArchiveError("Archive path conflicts with a file");
        }
        directories.add(parent);
      }

      const targetPath = path.resolve(stagingDirectory, ...segments);
      const relativeToStage = path.relative(stagingDirectory, targetPath);
      if (
        relativeToStage.startsWith(`..${path.sep}`) ||
        relativeToStage === ".." ||
        path.isAbsolute(relativeToStage)
      ) {
        throw new InvalidImportArchiveError("Archive path escapes staging");
      }

      if (header.type === "directory") {
        if (directories.has(relativePath) || explicitEntries.has(relativePath)) {
          throw new InvalidImportArchiveError("Archive contains duplicate paths");
        }
        directories.add(relativePath);
        explicitEntries.add(relativePath);
        await fs.mkdir(targetPath, { recursive: true, mode: 0o700 });
        next();
        return;
      }

      if (header.type !== "file") {
        throw new InvalidImportArchiveError("Archive contains a link or special file");
      }

      if (!Number.isSafeInteger(header.size) || header.size! < 0) {
        throw new InvalidImportArchiveError("Archive contains an invalid file size");
      }
      if (header.size! > MAX_IMPORT_FILE_BYTES) {
        throw new InvalidImportArchiveError("Archive contains an oversized file");
      }

      const isAttachment = segments[0] === "attachments" && segments.length > 1;
      if (
        (segments[0] === "attachments" && !isAttachment) ||
        (!isAttachment && !hasAllowedExtension(path.basename(relativePath)))
      ) {
        throw new InvalidImportArchiveError("Archive contains an unsupported file");
      }
      if (directories.has(relativePath)) {
        throw new InvalidImportArchiveError("Archive path conflicts with a directory");
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
      const handle = await fs.open(targetPath, "wx", 0o600);
      let fileBytes = 0;
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of entry as AsyncIterable<Buffer>) {
          fileBytes += chunk.length;
          if (fileBytes > header.size!) {
            throw new InvalidImportArchiveError("Archive file size is invalid");
          }
          chunks.push(Buffer.from(chunk));
        }
        if (fileBytes !== header.size) {
          throw new InvalidImportArchiveError("Archive file size is invalid");
        }
        await handle.writeFile(Buffer.concat(chunks));
      } finally {
        await handle.close();
      }

      explicitEntries.add(relativePath);
      files.push({ relativePath, stagedPath: targetPath });
      next();
    })().catch((error: unknown) => {
      next(
        error instanceof Error
          ? error
          : new InvalidImportArchiveError("Archive could not be extracted"),
      );
    });
  });

  const expandedLimit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      expandedBytes += chunk.length;
      if (expandedBytes > MAX_IMPORT_EXPANDED_BYTES) {
        callback(new InvalidImportArchiveError("Archive exceeds the expanded size limit"));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.from(archive),
      createGunzip(),
      expandedLimit,
      parser,
    );
  } catch (error) {
    if (error instanceof InvalidImportArchiveError) throw error;
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode?.startsWith("E")) throw error;
    throw new InvalidImportArchiveError("Archive is invalid or corrupt");
  }

  return files;
}