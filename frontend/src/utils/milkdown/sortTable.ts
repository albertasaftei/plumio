import { closeHistory } from "@milkdown/prose/history";
import { Selection } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";

export function sortTable(view: EditorView, direction: "asc" | "desc") {
  const { state } = view;
  const { $head } = state.selection;
  let rowDepth = $head.depth;
  while (rowDepth > 0 && $head.node(rowDepth).type.name !== "table_row") {
    rowDepth--;
  }
  if (rowDepth < 2 || rowDepth === $head.depth) return;

  const table = $head.node(rowDepth - 1);
  if (table.type.name !== "table" || table.childCount < 3) return;

  const column = $head.index(rowDepth);
  const selectedRow = $head.index(rowDepth - 1);
  const rows = [];
  for (let index = 1; index < table.childCount; index++) {
    const row = table.child(index);
    rows.push({ row, index, key: row.maybeChild(column)?.textContent.trim() ?? "" });
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  rows.sort((a, b) => {
    if (!a.key || !b.key) return Number(!a.key) - Number(!b.key);
    return collator.compare(a.key, b.key) * (direction === "asc" ? 1 : -1);
  });
  if (rows.every(({ index }, offset) => index === offset + 1)) return;

  const bodyStart = $head.start(rowDepth - 1) + table.child(0).nodeSize;
  const transaction = closeHistory(state.tr.replaceWith(
    bodyStart,
    $head.end(rowDepth - 1),
    rows.map(({ row }) => row),
  ));

  let cursor = $head.pos;
  if (selectedRow > 0) {
    cursor = bodyStart + ($head.pos - $head.before(rowDepth));
    for (const { row, index } of rows) {
      if (index === selectedRow) break;
      cursor += row.nodeSize;
    }
  }
  transaction.setSelection(Selection.near(transaction.doc.resolve(cursor)));
  view.dispatch(transaction.scrollIntoView());
  view.dispatch(closeHistory(view.state.tr));
}
