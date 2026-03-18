import type { Data, Processor } from "unified";
import { visit } from "unist-util-visit";
import type {
  Handle,
  Options as ToMarkdownExtension,
} from "mdast-util-to-markdown";
import type { Parent, Root } from "mdast";

declare module "mdast" {
  export interface TextColor extends Parent {
    type: "textColor";
    data: {
      color: string;
    };
    children: PhrasingContent[];
  }

  interface StaticPhrasingContentMap {
    textColor: TextColor;
  }

  interface PhrasingContentMap {
    textColor: TextColor;
  }

  interface RootContentMap {
    textColor: TextColor;
  }
}

// Matches opening tags like:
//   <span style="color: #ff0000">
//   <span style="color:red">
//   <span data-text-color="#ff0000" style="color: #ff0000">
const SPAN_OPEN_RE =
  /^<span\s[^>]*style="[^"]*color:\s*([^;"+]+)[^"]*"[^>]*>$/i;
const SPAN_CLOSE_RE = /^<\/span>$/i;

/**
 * Remark plugin to support text color via inline HTML spans.
 *
 * Parses:   <span style="color: #ff0000">text</span>
 * Produces: textColor mdast node with { data: { color: "#ff0000" } }
 *
 * Serializes back to: <span style="color: #ff0000">text</span>
 */
export function remarkTextColor(this: Processor) {
  const data = this.data();
  add(data, "toMarkdownExtensions", textColorToMarkdown);

  return (tree: Root) => {
    // Walk all parent nodes (paragraphs, list items, blockquotes, etc.)
    visit(tree, (node) => {
      const parent = node as unknown as Parent;
      if (!parent.children || !Array.isArray(parent.children)) return;

      let i = 0;
      while (i < parent.children.length) {
        const child = parent.children[i] as any;

        if (child.type !== "html") {
          i++;
          continue;
        }

        const openMatch = child.value?.match(SPAN_OPEN_RE);
        if (!openMatch) {
          i++;
          continue;
        }

        const color = openMatch[1].trim();

        // Find matching closing </span>
        let closeIdx = -1;
        for (let j = i + 1; j < parent.children.length; j++) {
          const sibling = parent.children[j] as any;
          if (sibling.type === "html" && SPAN_CLOSE_RE.test(sibling.value)) {
            closeIdx = j;
            break;
          }
        }

        if (closeIdx === -1) {
          i++;
          continue;
        }

        // Grab everything between the open and close tags
        const children = parent.children.slice(i + 1, closeIdx) as any[];

        const textColorNode: any = {
          type: "textColor",
          data: { color },
          children,
        };

        // Replace the open-tag, content, and close-tag with a single node
        parent.children.splice(i, closeIdx - i + 1, textColorNode);
        // Don't increment — re-visit in case of nested spans
      }
    });
  };
}

// ── Serializer ──────────────────────────────────────────────────────────────

const handleTextColor: Handle = (node, _, state, info) => {
  const color = (node as any).data?.color ?? "inherit";
  const tracker = state.createTracker(info);

  const open = `<span style="color: ${color}">`;
  const close = `</span>`;

  let value = tracker.move(open);
  value += tracker.move(
    state.containerPhrasing(node as any, {
      before: value,
      after: close,
      ...tracker.current(),
    }),
  );
  value += tracker.move(close);
  return value;
};

const textColorToMarkdown: ToMarkdownExtension = {
  unsafe: [],
  handlers: {
    textColor: handleTextColor,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function add(
  data: Data,
  field: "toMarkdownExtensions",
  value: ToMarkdownExtension,
) {
  // @ts-ignore
  const list = (data[field] = data[field] || []);
  if (!list.includes(value)) list.push(value);
}
