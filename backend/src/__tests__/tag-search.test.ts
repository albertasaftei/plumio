import { beforeAll, describe, expect, it } from "vitest";
import db from "../db/index.js";
import { request, setupAdmin, registerAndLogin } from "./helpers.js";
import { serializeTagQuery } from "../routes/documents/helpers/search-query.js";

let token: string;
let org: number;
let user: number;
let otherToken: string;
let otherOrg: number;
let otherUser: number;
const special = 'Meeting "Notes" \\ & + #';

async function search(q: string, auth = token) {
  return request("GET", `/api/documents/search?q=${encodeURIComponent(q)}`, { token: auth, headers: { "X-Org-Id": String(org) } });
}
async function paths(q: string) {
  const res = await search(q);
  expect(res.status).toBe(200);
  return (await res.json()).results.map((r: { path: string }) => r.path);
}
function tag(name: string, owner = user, organization = org) {
  return Number(db.prepare("INSERT INTO tags (user_id, organization_id, name) VALUES (?, ?, ?)").run(owner, organization, name).lastInsertRowid);
}
function attach(path: string, id: number, organization = org) {
  db.prepare("INSERT INTO document_tags (document_id, tag_id) SELECT id, ? FROM documents WHERE path = ? AND organization_id = ?").run(id, path, organization);
}

beforeAll(async () => {
  const admin = await setupAdmin();
  token = admin.token;
  org = admin.currentOrganization.id;
  user = (db.prepare("SELECT id FROM users WHERE username = 'testadmin'").get() as { id: number }).id;
  const other = await registerAndLogin("othersearch", "othersearch@test.com");
  otherToken = other.token;
  otherOrg = other.currentOrganization.id;
  otherUser = (db.prepare("SELECT id FROM users WHERE username = 'othersearch'").get() as { id: number }).id;
  for (const [name, content, auth] of [
    ["A", 'budget <script>alert(1)</script>', token],
    ["B", "different topic", token],
    ["C", "budget untagged", token],
    ["Archived", "budget", token],
    ["Deleted", "budget", token],
    ["NoIndex", "unindexed", token],
    ["OtherOrg", "budget", otherToken],
  ]) {
    const res = await request("POST", "/api/documents/save", { token: auth, body: { folder: "/", name, content, isNew: true } });
    expect(res.status).toBe(200);
  }
  const meeting = tag("Meeting Notes");
  const second = tag("Review");
  const punctuation = tag(special);
  for (const name of ["A", "B", "Archived", "Deleted", "NoIndex"]) attach(`/${name}.md`, meeting);
  attach("/A.md", second);
  attach("/C.md", tag("MeetingNotes"));
  attach("/A.md", punctuation);
  attach("/C.md", tag("Private", otherUser));
  attach("/C.md", tag("ForeignOrg", user, otherOrg));
  attach("/OtherOrg.md", tag("Meeting Notes", otherUser, otherOrg), otherOrg);
  db.prepare("UPDATE documents SET archived = 1 WHERE path = '/Archived.md' AND organization_id = ?").run(org);
  db.prepare("UPDATE documents SET deleted = 1 WHERE path = '/Deleted.md' AND organization_id = ?").run(org);
  db.prepare("UPDATE documents SET updated_at = '2026-01-01' WHERE organization_id = ?").run(org);
  db.prepare("UPDATE documents SET updated_at = '2026-02-01' WHERE path = '/B.md' AND organization_id = ?").run(org);
  db.prepare("DELETE FROM documents_fts WHERE rowid IN (SELECT id FROM documents WHERE path = '/NoIndex.md' AND organization_id = ?)").run(org);
});

describe("tag-aware document search", () => {
  it("finds tagged active notes in modification order without requiring FTS rows", async () => {
    const res = await search('tag:"Meeting Notes"');
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results.map((r: { path: string }) => r.path)).toEqual(["/B.md", "/A.md", "/NoIndex.md"]);
    expect(results.every((r: { snippet: string }) => r.snippet === "")).toBe(true);
  });
  it("supports unquoted names without treating them as names with spaces", async () => {
    expect(await paths("tag:MeetingNotes")).toEqual(["/C.md"]);
    expect(await paths('tag:"MeetingNotes"')).toEqual(["/C.md"]);
    expect(await paths('tag:"Meeting Notes"')).toEqual(["/B.md", "/A.md", "/NoIndex.md"]);
  });
  it("intersects text and all tags without duplicates", async () => {
    expect(await paths('budget tag:"Meeting Notes"')).toEqual(["/A.md"]);
    expect(await paths('tag:Review tag:"Meeting Notes" tag:Review')).toEqual(["/A.md"]);
    expect(await paths('different tag:Review')).toEqual([]);
  });
  it("preserves text token OR matching, prefix matching, and ranking", async () => {
    const ordinary = await paths("budg unrelated");
    expect(ordinary.sort()).toEqual(["/A.md", "/C.md"]);
    const before = await search("budget");
    const after = await search('budget tag:"Meeting Notes"');
    const expected = (await before.json()).results.filter((r: { path: string }) => r.path === "/A.md");
    expect((await after.json()).results).toEqual(expected);
    expect(expected[0].snippet).toContain("<mark>budget</mark>");
    expect(expected[0].snippet).not.toContain("<script>");
    expect(expected[0].snippet).toContain("&lt;script&gt;");
  });
  it("matches exact names and safely handles punctuation", async () => {
    expect(await paths("tag:missing")).toEqual([]);
    expect(await paths('tag:"meeting notes"')).toEqual([]);
    expect(await paths(serializeTagQuery(special))).toEqual(["/A.md"]);
    expect(await paths(serializeTagQuery("x' OR 1=1 --"))).toEqual([]);
    expect(await paths("tag:Private")).toEqual([]);
    expect(await paths("tag:ForeignOrg")).toEqual([]);
  });
  it("keeps other organizations isolated", async () => {
    const res = await search('tag:"Meeting Notes"', otherToken);
    expect((await res.json()).results.map((r: { path: string }) => r.path)).toEqual(["/OtherOrg.md"]);
  });
  it.each(["tag:", 'tag:"unfinished', 'tag:""', 'tag:"A"extra'])("returns actionable validation for %s", async (q) => {
    const res = await search(q);
    expect(res.status).toBe(400);
    expect((await res.json()).error.length).toBeGreaterThan(20);
  });
  it("requires both read permissions for API keys", async () => {
    for (const permissions of [["documents:read"], ["tags:read"], ["documents:read", "tags:read"]]) {
      const created = await request("POST", "/api/api-keys", { token, body: { name: permissions.join(), permissions } });
      expect(created.status).toBe(201);
      const { apiKey } = await created.json();
      expect((await search('tag:"Meeting Notes"', apiKey.key)).status).toBe(permissions.length === 2 ? 200 : 403);
      if (permissions[0] === "documents:read") expect((await search("budget", apiKey.key)).status).toBe(200);
    }
  });
});
