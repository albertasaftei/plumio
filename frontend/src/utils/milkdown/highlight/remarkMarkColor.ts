import { highlightMark } from "micromark-extension-highlight-mark";
import type { Data, Processor } from "unified";
import { visit } from "unist-util-visit";
import type {
  Handle,
  Options as ToMarkdownExtension,
} from "mdast-util-to-markdown";
import type { Extension as MicromarkExtension } from "micromark-util-types";
import type { Parent, Root, RootContent } from "mdast";
import type {
  CompileContext,
  Extension as FromMarkdownExtension,
} from "mdast-util-from-markdown";
import type { Token } from "micromark-util-types";

declare module "mdast-util-to-markdown" {
  interface ConstructNameMap {
    mark: "mark";
  }
}

declare module "mdast" {
  export interface Mark extends Parent {
    type: "mark";
    data: {
      color?: string;
    };
    children: PhrasingContent[];
  }

  export interface StaticPhrasingContentMap {
    mark: Mark;
  }

  interface PhrasingContentMap {
    mark: Mark;
  }

  interface RootContentMap {
    mark: Mark;
  }
}

/**
 * remark plugin to support ==highlighted text== syntax, optionally with a color: =={#ff0}text==
 *
 * It recognises highlights in the markdown and converts them to `mark` nodes in mdast.
 * A `mark` node looks like:
 * {
 *   type: 'mark',
 *   data: { color?: string },
 *   children: [...]
 * }
 *
 * The plugin also teaches `remark-stringify` how to turn those nodes back into markdown.
 */
export function remarkMarkColor(this: Processor) {
  const data = this.data();
  // Register micromark + mdast extensions at parser stage
  add(data, "micromarkExtensions", highlightMark());
  add(data, "fromMarkdownExtensions", markColorFromMarkdown);
  add(data, "toMarkdownExtensions", markColorToMarkdown);

  // Transformer: convert `highlight` -> `mark` & parse color
  return (tree: Root) => {
    visit(
      tree,
      "highlight",
      (node: RootContent & Parent, index: number, parent: Parent) => {
        if (!parent) return;
        const first = node.children[0];
        let color;
        if (first && first.type === "text") {
          const match = /^\{([^}]+)\}/.exec(first.value);
          if (match) {
            color = match[1];
            first.value = first.value.slice(match[0].length);
            if (first.value.length === 0) {
              node.children.shift();
            }
          }
        }
        node.type = "mark";
        if (color) {
          node.data = { ...node.data, color };
        }
        // update in parent
        parent.children[index] = node;
      },
    );
  };
}

/**
 * Serialize `mark` node back to markdown.
 * Courtesy of mdast-util-highlight-mark implementation but extended for `{color}`.
 */
const handleMarkColor: Handle = (node, _, state, info) => {
  const marker = "==";
  const tracker = state.createTracker(info);
  const exit = state.enter("mark");
  let value = tracker.move(marker);
  // prepend color if any
  if (node.data && node.data.color) {
    value += tracker.move("{" + node.data.color + "}");
  }
  value += tracker.move(
    state.containerPhrasing(node, {
      before: value,
      after: marker,
      ...tracker.current(),
    }),
  );
  value += tracker.move(marker);
  exit();
  return value;
};

const markColorToMarkdown: ToMarkdownExtension = {
  unsafe: [
    // Copy from highlight-mark's unsafe definition so `==` inside phrasing escapes correctly
    {
      character: "=",
      inConstruct: "phrasing",
      notInConstruct: [
        "autolink",
        "destinationLiteral",
        "destinationRaw",
        "reference",
        "titleQuote",
        "titleApostrophe",
      ],
    },
  ],
  handlers: {
    mark: handleMarkColor,
  },
};

function add(
  data: Data,
  field:
    | "micromarkExtensions"
    | "fromMarkdownExtensions"
    | "toMarkdownExtensions",
  value:
    | ToMarkdownExtension
    | MicromarkExtension
    | FromMarkdownExtension
    | FromMarkdownExtension[],
) {
  // @ts-ignore
  const list = (data[field] = data[field] || []);
  if (Array.isArray(value)) {
    for (const v of value) {
      if (!list.includes(v)) list.push(v);
    }
  } else {
    if (!list.includes(value)) list.push(value);
  }
}

// ---------- FromMarkdown (token -> mdast) ----------
const markColorFromMarkdown: FromMarkdownExtension = {
  canContainEols: ["mark"],
  enter: { highlight: enterMark },
  exit: { highlight: exitMark },
};

function enterMark(this: CompileContext, token: Token) {
  // `this` is CompileContext
  this.enter({ type: "mark", children: [], data: {} }, token);
}

function exitMark(this: CompileContext, token: Token) {
  // node is currently on top of the stack
  const node = this.stack[this.stack.length - 1] as Parent;
  if (node && node.children && node.children.length) {
    const first = node.children[0];
    if (first?.type === "text") {
      const match = /^\{([^}]+)\}/.exec(first.value);
      if (match) {
        const color = match[1];
        node.data = { ...(node.data || {}), color };
        first.value = first.value.slice(match[0].length);
        if (first.value.length === 0) node.children.shift();
      }
    }
  }
  this.exit(token);
}
