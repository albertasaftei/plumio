import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";

/**
 * ProseMirror plugin that converts `[ ] ` or `[x] ` typed at the beginning of
 * a list item into a task list item (by setting the `checked` attribute).
 *
 * This works around a bug in Milkdown's GFM preset where the built-in
 * `wrapInTaskListInputRule` has incorrect depth traversal logic
 * (starts at depth 0 and decrements, never reaching the list_item node).
 */
export const taskListInputPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey("taskListInput"),

    // When Enter splits a checked task list item, the new item inherits
    // checked=true. This resets it to false.
    appendTransaction(transactions, _oldState, newState) {
      // Only look at transactions that changed the doc
      if (!transactions.some((tr) => tr.docChanged)) return null;

      let tr = newState.tr;
      let modified = false;

      // Find the current cursor position
      const { $from } = newState.selection;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === "list_item" && node.attrs.checked === true) {
          // Only reset if this is an empty task list item (just created by Enter)
          const firstChild = node.firstChild;
          if (
            firstChild &&
            firstChild.type.name === "paragraph" &&
            firstChild.textContent === ""
          ) {
            const pos = $from.before(d);
            tr = tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              checked: false,
            });
            modified = true;
            break;
          }
        }
      }

      return modified ? tr : null;
    },

    props: {
      handleTextInput(view, from, _to, text) {
        // Only trigger on space (the char after "[ ]" or "[x]")
        if (text !== " ") return false;

        const { state } = view;
        const $from = state.doc.resolve(from);
        const depth = $from.depth;

        if (depth < 2) return false;

        // Walk up from current position to find a list_item
        let listItemDepth = -1;
        for (let d = depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === "list_item") {
            // Skip if already a task list item
            if (node.attrs.checked != null) return false;
            listItemDepth = d;
            break;
          }
        }

        if (listItemDepth < 0) return false;

        // Check that we're in a paragraph (first child of list_item)
        const paragraph = $from.parent;
        if (paragraph.type.name !== "paragraph") return false;

        const indexInListItem = $from.index(listItemDepth);
        if (indexInListItem !== 0) return false;

        // Get text before cursor in this paragraph
        const textBefore = paragraph.textContent.slice(0, $from.parentOffset);

        // Match [ ] or [x] or [X]
        const match = textBefore.match(/^\[([ xX])\]$/);
        if (!match) return false;

        const checked = match[1].toLowerCase() === "x";
        const listItemNode = $from.node(listItemDepth);

        const tr = state.tr;

        // Delete the "[ ]" or "[x]" text
        const textStart = $from.start();
        tr.deleteRange(textStart, textStart + match[0].length);

        // Set the list_item's checked attribute to convert to task list item
        const listItemPos = $from.before(listItemDepth);
        tr.setNodeMarkup(listItemPos, undefined, {
          ...listItemNode.attrs,
          checked,
        });

        view.dispatch(tr);
        return true;
      },
    },
  });
});
