import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  getUniqueFilePath,
  getOrgDocumentsPath,
  resolveOrgPath,
  sanitizeFilename,
  writeFileNoFollow,
} from "../routes/documents/helpers/paths.js";

const created: string[] = [];

afterAll(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function writeExistingFile(organizationId: number, relPath: string) {
  const full = path.join(getOrgDocumentsPath(organizationId), relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, "existing");
  created.push(getOrgDocumentsPath(organizationId));
}

describe("getUniqueFilePath", () => {
  it("preserves no-extension filenames when generating a unique name", async () => {
    const orgId = 9001;
    // A file named "README" (no extension) already exists.
    writeExistingFile(orgId, "README");

    const result = await getUniqueFilePath("README", orgId, true);

    // The original filename must be retained: "README (1)", not " (1)".
    expect(path.basename(result)).toBe("README (1)");
  });

  it("keeps the extension for files that have one", async () => {
    const orgId = 9002;
    writeExistingFile(orgId, "notes.md");

    const result = await getUniqueFilePath("notes.md", orgId, true);

    expect(path.basename(result)).toBe("notes (1).md");
  });
});

describe("sanitizeFilename", () => {
  it("strips a trailing dot even when whitespace follows it", () => {
    // Regression: a trailing space kept the dot out of the /\.+$/ match,
    // and the later trim() re-exposed it, leaving "Report." on disk —
    // a name Windows rejects.
    expect(sanitizeFilename("Report. ")).toBe("Report");
    expect(sanitizeFilename("Q1 2026. ")).toBe("Q1 2026");
    expect(sanitizeFilename("notes.. ")).toBe("notes");
  });

  it("still strips plain trailing dots and surrounding whitespace", () => {
    expect(sanitizeFilename("Report.")).toBe("Report");
    expect(sanitizeFilename("Report .")).toBe("Report");
    expect(sanitizeFilename("  hi  ")).toBe("hi");
  });

  it("preserves internal dots and leading dots", () => {
    expect(sanitizeFilename("a.b.")).toBe("a.b");
    expect(sanitizeFilename(".hidden")).toBe(".hidden");
  });
});

describe("resolveOrgPath", () => {
  it("rejects traversal outside the organization root", async () => {
    await expect(resolveOrgPath("../../outside.md", 9003)).rejects.toThrow(
      "Path escapes organization directory",
    );
  });

  it("rejects symlink destinations for reads and writes", async () => {
    const orgId = 9004;
    const orgPath = getOrgDocumentsPath(orgId);
    const sentinelPath = path.join(path.dirname(orgPath), "outside-sentinel.txt");
    const symlinkPath = path.join(orgPath, "linked.md");
    fs.mkdirSync(orgPath, { recursive: true });
    fs.writeFileSync(sentinelPath, "unchanged");
    fs.symlinkSync(sentinelPath, symlinkPath);
    created.push(orgPath);

    await expect(resolveOrgPath("/linked.md", orgId)).rejects.toThrow(
      "Symbolic links are not allowed",
    );
    await expect(writeFileNoFollow(symlinkPath, "changed")).rejects.toThrow(
      "Symbolic link destinations are not allowed",
    );
    expect(fs.readFileSync(sentinelPath, "utf-8")).toBe("unchanged");
    fs.unlinkSync(sentinelPath);
  });
});
