import type { Data, Processor } from "unified";
import { visit } from "unist-util-visit";
import type {
  Handle,
  Options as ToMarkdownExtension,
} from "mdast-util-to-markdown";
import type { Parent, Root } from "mdast";

declare module "mdast" {
  export interface FontFamily extends Parent {
    type: "fontFamily";
    data: {
      family: string;
    };
    children: PhrasingContent[];
  }

  interface StaticPhrasingContentMap {
    fontFamily: FontFamily;
  }

  interface PhrasingContentMap {
    fontFamily: FontFamily;
  }

  interface RootContentMap {
    fontFamily: FontFamily;
  }
}

// Captures the full style attribute value from any <span style="..."> tag
const SPAN_WITH_STYLE_RE = /^<span\s[^>]*style="([^"]*)"[^>]*>$/i;
// Extracts the font-family value from a style string
const FONT_FAMILY_IN_STYLE_RE = /(?:^|;)\s*font-family:\s*([^;"]+)/i;
// Matches ANY span open tag (used for nesting depth tracking)
const ANY_SPAN_OPEN_RE = /^<span[\s>]/i;
const SPAN_CLOSE_RE = /^<\/span>$/i;

/**
 * Remark plugin to support font family via inline HTML spans.
 *
 * Parses:   <span style="font-family: Georgia, serif">text</span>
 * Produces: fontFamily mdast node with { data: { family: "Georgia, serif" } }
 *
 * Skips combined spans (those that also contain color:) — remarkTextColor
 * handles those and creates the nested fontFamily node inside textColor.
 *
 * Serializes back to a single combined span when both marks are present.
 */
export function remarkFontFamily(this: Processor) {
  const data = this.data();
  add(data, "toMarkdownExtensions", fontFamilyToMarkdown);

  return (tree: Root) => {
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

        const spanMatch = child.value?.match(SPAN_WITH_STYLE_RE);
        if (!spanMatch) {
          i++;
          continue;
        }

        const styleAttr = spanMatch[1];

        // Skip combined spans — remarkTextColor handles those
        if (/(?:^|;)\s*color:/i.test(styleAttr)) {
          i++;
          continue;
        }

        const familyMatch = styleAttr.match(FONT_FAMILY_IN_STYLE_RE);
        if (!familyMatch) {
          i++;
          continue;
        }

        const family = familyMatch[1].trim();

        // Find the matching closing </span>, skipping over any nested spans
        let closeIdx = -1;
        let depth = 0;
        for (let j = i + 1; j < parent.children.length; j++) {
          const sibling = parent.children[j] as any;
          if (sibling.type === "html") {
            if (ANY_SPAN_OPEN_RE.test(sibling.value)) {
              depth++;
            } else if (SPAN_CLOSE_RE.test(sibling.value)) {
              if (depth === 0) {
                closeIdx = j;
                break;
              }
              depth--;
            }
          }
        }

        if (closeIdx === -1) {
          i++;
          continue;
        }

        // Grab everything between the open and close tags
        const children = parent.children.slice(i + 1, closeIdx) as any[];

        const fontFamilyNode: any = {
          type: "fontFamily",
          data: { family },
          children,
        };

        // Replace the open-tag, content, and close-tag with a single node
        parent.children.splice(i, closeIdx - i + 1, fontFamilyNode);
        // Don't increment — re-visit in case of nested spans
      }
    });
  };
}

// ── Serializer ──────────────────────────────────────────────────────────────

const handleFontFamily: Handle = (node, _, state, info) => {
  const family = (node as any).data?.family ?? "inherit";
  const tracker = state.createTracker(info);

  // If the sole child is a textColor node, emit a single combined span
  // (handles old notes saved with fontFamily as the outer mark)
  const nodeChildren = (node as any).children ?? [];
  if (nodeChildren.length === 1 && nodeChildren[0].type === "textColor") {
    const color = nodeChildren[0].data?.color ?? "inherit";
    const open = `<span style="font-family: ${family}; color: ${color}">`;
    const close = `</span>`;
    let value = tracker.move(open);
    value += tracker.move(
      state.containerPhrasing(nodeChildren[0] as any, {
        before: value,
        after: close,
        ...tracker.current(),
      }),
    );
    value += tracker.move(close);
    return value;
  }

  const open = `<span style="font-family: ${family}">`;
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

const fontFamilyToMarkdown: ToMarkdownExtension = {
  unsafe: [],
  handlers: {
    fontFamily: handleFontFamily,
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
