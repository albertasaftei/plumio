import { $markSchema } from "@milkdown/utils";
import { Mark } from "mdast";

export const DEFAULT_COLOR = "#ffee99";

export const markSchema = $markSchema("mark", () => {
  return {
    attrs: {
      color: {
        default: DEFAULT_COLOR,
        validate: "string",
      },
    },
    parseDOM: [
      {
        tag: "mark",
        getAttrs: (node: HTMLElement) => {
          return {
            color: node.style.backgroundColor,
          };
        },
      },
    ],
    toDOM: (mark) => [
      "mark",
      { style: `background-color: ${mark.attrs.color}` },
    ],
    parseMarkdown: {
      match: (node) => node.type === "mark",
      runner: (state, node, markType) => {
        const color = (node as Mark).data?.color;
        state.openMark(markType, { color });
        state.next(node.children);
        state.closeMark(markType);
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === "mark",
      runner: (state, mark) => {
        let color = mark.attrs.color;
        if (color?.toLowerCase() === DEFAULT_COLOR.toLowerCase()) {
          color = undefined;
        }
        state.withMark(mark, "mark", undefined, {
          data: { color },
        });
      },
    },
  };
});
