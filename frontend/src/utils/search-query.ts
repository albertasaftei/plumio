// Kept identical in frontend/backend: each is built and packaged independently.
export class SearchQueryError extends Error {
  constructor(public code: "emptyTag" | "unclosedTag" | "invalidTag") {
    super({
      emptyTag: 'Enter a tag name after tag:, for example tag:"Meeting Notes".',
      unclosedTag: 'Close the quoted tag name, for example tag:"Meeting Notes".',
      invalidTag: 'Separate a quoted tag filter from other terms with a space.',
    }[code]);
  }
}

export function parseSearchQuery(query: string): { text: string; tags: string[] } {
  const text: string[] = [];
  const tags: string[] = [];
  let i = 0;
  while (i < query.length) {
    if (query.startsWith("tag:", i) && (i === 0 || /\s/.test(query[i - 1]))) {
      i += 4;
      let name = "";
      if (query[i] === '"') {
        i++;
        let closed = false;
        while (i < query.length) {
          const char = query[i++];
          if (char === '"') { closed = true; break; }
          if (char === "\\" && (query[i] === '"' || query[i] === "\\")) {
            name += query[i++];
          } else {
            name += char;
          }
        }
        if (!closed) throw new SearchQueryError("unclosedTag");
        if (i < query.length && !/\s/.test(query[i])) throw new SearchQueryError("invalidTag");
      } else {
        while (i < query.length && !/\s/.test(query[i])) name += query[i++];
      }
      if (!name.trim()) throw new SearchQueryError("emptyTag");
      tags.push(name);
      text.push(" ");
    } else {
      text.push(query[i++]);
    }
  }
  return { text: text.join("").trim(), tags: [...new Set(tags)] };
}

export function serializeTagQuery(name: string): string {
  return `tag:"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function tagSearchHref(name: string): string {
  return `/search?q=${encodeURIComponent(serializeTagQuery(name))}`;
}
