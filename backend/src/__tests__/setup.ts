import { beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Set env vars BEFORE any app imports
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plumio-test-"));

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.DOCUMENTS_PATH = tmpDir;
process.env.JWT_SECRET = "test-secret-key-for-testing-only-1234567890";

afterAll(() => {
  // Clean up temp directory
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
