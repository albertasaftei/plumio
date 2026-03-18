import { $markSchema } from "@milkdown/utils";

export const textColorSchema = $markSchema("textColor", () => {
  return {
    attrs: {
      color: {
        default: null,
        validate: "string|null",
      },
    },
    parseDOM: [
      {
        tag: "span[data-text-color]",
        getAttrs: (node: HTMLElement) => ({
          color: node.style.color || null,
        }),
      },
      {
        // Also match plain colored spans from clipboard paste
        tag: "span",
        getAttrs: (node: HTMLElement) => {
          const color = node.style.color;
          return color ? { color } : false;
        },
        priority: 10,
      },
    ],
    toDOM: (mark) => [
      "span",
      {
        style: `color: ${mark.attrs.color}`,
        "data-text-color": mark.attrs.color || "",
      },
    ],
    parseMarkdown: {
      match: (node) => node.type === "textColor",
      runner: (state, node, markType) => {
        const color = (node as any).data?.color;
        state.openMark(markType, { color });
        state.next(node.children);
        state.closeMark(markType);
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === "textColor",
      runner: (state, mark) => {
        state.withMark(mark, "textColor", undefined, {
          data: { color: mark.attrs.color },
        });
      },
    },
  };
});
