import { describe, expect, it } from "vitest";
import * as backend from "../routes/documents/helpers/search-query.js";
import * as frontend from "../../../frontend/src/utils/search-query";

for (const [name, parser] of [["backend", backend], ["frontend", frontend]] as const) {
  describe(`${name} search query`, () => {
    it.each([
      ["budget", { text: "budget", tags: [] }],
      ["tag:MeetingNotes", { text: "", tags: ["MeetingNotes"] }],
      ['budget tag:"Meeting Notes"', { text: "budget", tags: ["Meeting Notes"] }],
      ['tag:A tag:B tag:A', { text: "", tags: ["A", "B"] }],
      ['tag:"a\\"b\\\\c" report', { text: "report", tags: ['a"b\\c'] }],
      ['other:thing x-tag:A', { text: 'other:thing x-tag:A', tags: [] }],
      ['tag:日本語', { text: '', tags: ['日本語'] }],
    ])("parses %s", (query, result) => expect(parser.parseSearchQuery(query)).toEqual(result));

    it.each(['tag:', 'tag: ', 'tag:""', 'tag:"  "', 'tag:"unfinished', 'tag:"A"suffix'])('rejects malformed %s', (query) => {
      expect(() => parser.parseSearchQuery(query)).toThrow(parser.SearchQueryError);
    });

    it.each(['Meeting Notes', 'a"b\\c', "quote' & # + / ?", '日本語', 'line\nbreak'])('round-trips %s', (name) => {
      expect(parser.parseSearchQuery(parser.serializeTagQuery(name))).toEqual({ text: "", tags: [name] });
    });
  });
}

it("builds an encoded link preserving the complete tag name", () => {
  const name = 'Meeting "Notes" & + #';
  const url = new URL(frontend.tagSearchHref(name), "https://example.test");
  expect(frontend.parseSearchQuery(url.searchParams.get("q")!)).toEqual({ text: "", tags: [name] });
});
