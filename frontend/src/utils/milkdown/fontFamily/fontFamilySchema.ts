import { $markSchema } from "@milkdown/utils";

export const fontFamilySchema = $markSchema("fontFamily", () => {
  return {
    attrs: {
      family: {
        default: null,
        validate: "string|null",
      },
    },
    parseDOM: [
      {
        tag: "span[data-font-family]",
        getAttrs: (node: HTMLElement) => ({
          family: node.style.fontFamily || null,
        }),
      },
      {
        // Also match spans with font-family from clipboard paste
        tag: "span",
        getAttrs: (node: HTMLElement) => {
          const family = node.style.fontFamily;
          return family ? { family } : false;
        },
        priority: 10,
      },
    ],
    toDOM: (mark) => [
      "span",
      {
        style: `font-family: ${mark.attrs.family}`,
        "data-font-family": mark.attrs.family || "",
      },
    ],
    parseMarkdown: {
      match: (node) => node.type === "fontFamily",
      runner: (state, node, markType) => {
        const family = (node as any).data?.family;
        state.openMark(markType, { family });
        state.next(node.children);
        state.closeMark(markType);
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === "fontFamily",
      runner: (state, mark) => {
        state.withMark(mark, "fontFamily", undefined, {
          data: { family: mark.attrs.family },
        });
      },
    },
  };
});
