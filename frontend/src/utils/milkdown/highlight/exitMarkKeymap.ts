import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";

/**
 * Plugin to handle exiting highlight marks when pressing arrow keys at boundaries
 */
export const exitMarkKeymap = $prose(() => {
  return new Plugin({
    key: new PluginKey("exitMarkKeymap"),
    props: {
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;

        // Only handle arrow right key
        if (event.key !== "ArrowRight") {
          return false;
        }

        // Check if we're at a cursor position (not a selection)
        if (!selection.empty) {
          return false;
        }

        // Get the mark type from the schema by name
        const markType = state.schema.marks.mark;
        if (!markType) {
          return false;
        }

        const { $from } = selection;

        // Check if cursor is currently inside the highlight mark
        const currentMarks = $from.marks();
        const hasHighlightMark = currentMarks.some(
          (mark) => mark.type === markType,
        );

        if (hasHighlightMark) {
          // Check if we're at the end of the marked text
          const pos = $from.pos;
          const nodeAfter = state.doc.resolve(pos).nodeAfter;

          // If there's text after and it doesn't have the mark, or we're at the end
          if (nodeAfter) {
            const marksAfter = nodeAfter.marks || [];
            const hasMarkAfter = marksAfter.some(
              (mark) => mark.type === markType,
            );

            if (!hasMarkAfter) {
              // We're at the boundary, insert a space without the mark
              const tr = state.tr;
              tr.setStoredMarks([]);
              tr.insertText(" ", pos);
              tr.removeMark(pos, pos + 1, markType);
              const newPos = pos + 1;
              tr.setSelection(
                selection.constructor.near(tr.doc.resolve(newPos)),
              );
              view.dispatch(tr);
              return true; // Prevent default arrow behavior
            }
          } else {
            // No node after, we're at the end of the line/document
            // Insert a space without the mark
            const tr = state.tr;
            tr.setStoredMarks([]);
            tr.insertText(" ", pos);
            tr.removeMark(pos, pos + 1, markType);
            const newPos = pos + 1;
            tr.setSelection(selection.constructor.near(tr.doc.resolve(newPos)));
            view.dispatch(tr);
            return true; // Prevent default arrow behavior
          }
        }

        return false;
      },
    },
  });
});
