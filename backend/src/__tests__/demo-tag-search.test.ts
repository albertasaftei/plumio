import { beforeAll, expect, it, vi } from "vitest";
import { demoClient } from "../../../frontend/src/lib/demo/demo-client";
import { saveDemoDocuments, saveDemoTags, saveDemoTagMappings } from "../../../frontend/src/lib/demo/demo-storage";

beforeAll(() => {
  vi.stubGlobal("window", {});
  const data = new Map<string, string>([["plumio_demo:seeded", "true"]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  saveDemoDocuments([
    { path: "/A.md", content: "budget <script>unsafe</script>", modified: "2026-01-01", size: 1 },
    { path: "/B.md", content: "other topic", modified: "2026-02-01", size: 1 },
    { path: "/C.md", content: "budget", modified: "2026-01-01", size: 1 },
    { path: "/D.md", content: "budget", modified: "2026-01-01", size: 1, deleted: true },
    { path: "/E.md", content: "budget", modified: "2026-01-01", size: 1, archived: true },
  ]);
  saveDemoTags([
    { id: 3, name: "MeetingNotes", color: null, description: null, created_at: "", updated_at: "" },
    { id: 1, name: "Meeting Notes", color: null, description: null, created_at: "", updated_at: "" },
    { id: 2, name: 'Review "A"', color: null, description: null, created_at: "", updated_at: "" },
  ]);
  saveDemoTagMappings({ "/A.md": [1, 2], "/B.md": [1], "/C.md": [3], "/D.md": [1], "/E.md": [1] });
});

it("supports tag-only demo results with ordering and no snippets", async () => {
  const { results } = await demoClient.searchDocuments('tag:"Meeting Notes"');
  expect(results.map((r) => r.path)).toEqual(["/B.md", "/A.md"]);
  expect(results.every((r) => r.snippet === "")).toBe(true);
});
it("combines all tags with text and preserves safe snippets", async () => {
  const { results } = await demoClient.searchDocuments('budget tag:"Meeting Notes" tag:"Review \\"A\\""');
  expect(results.map((r) => r.path)).toEqual(["/A.md"]);
  expect(results[0].snippet).toContain("<mark>budget</mark>");
  expect(results[0].snippet).not.toContain("<script>");
  expect(results[0].snippet).toContain("&lt;script&gt;");
});
it("does not broaden unknown or differently cased tags", async () => {
  expect((await demoClient.searchDocuments('tag:missing budget')).results).toEqual([]);
  expect((await demoClient.searchDocuments('tag:"meeting notes"')).results).toEqual([]);
});
it("rejects malformed queries in demo mode", async () => {
  await expect(demoClient.searchDocuments('tag:"unfinished')).rejects.toThrow();
});

it("supports quoted and unquoted exact tag names in demo mode", async () => {
  const unquoted = await demoClient.searchDocuments("tag:MeetingNotes");
  expect(unquoted.results.map((r) => r.path)).toEqual(["/C.md"]);
  expect(await demoClient.searchDocuments('tag:"MeetingNotes"')).toEqual(unquoted);
  expect((await demoClient.searchDocuments('tag:"Meeting Notes"')).results.map((r) => r.path)).toEqual(["/B.md", "/A.md"]);
});
