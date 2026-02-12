import { Ctx } from "@milkdown/ctx";
import { tooltipFactory, TooltipProvider } from "@milkdown/plugin-tooltip";
import { EditorState, TextSelection } from "@milkdown/prose/state";
import { EditorView } from "@milkdown/prose/view";
import { DEFAULT_COLOR, markSchema } from "./markSchema";
import { debounce } from "lodash-es";
import { editorViewCtx } from "@milkdown/core";
import { Mark } from "@milkdown/prose/model";

class TooltipPluginView {
  content: HTMLDivElement;
  colorPicker: HTMLInputElement;
  closeButton: HTMLButtonElement;
  provider: TooltipProvider;
  ctx: Ctx;

  currentMark: Mark | null = null;
  manuallyClosed: boolean = false;
  lastClosedSelectionHash: string = "";

  listener = debounce((e: Event) => {
    const color = (e.target as HTMLInputElement).value;

    const view = this.ctx.get(editorViewCtx);
    if (!view.state || !this.currentMark) return;

    const { state } = view;
    const { selection } = state;
    const { from, to } = selection;

    const markType = markSchema.type(this.ctx);

    const tr = state.tr;

    tr.removeMark(from, to, markType);

    tr.addMark(from, to, markType.create({ color }));

    view.dispatch(tr);
  }, 20);

  closeHandler = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();

    const view = this.ctx.get(editorViewCtx);
    if (view.state) {
      const { from, to } = view.state.selection;
      this.lastClosedSelectionHash = `${from}-${to}`;
    }

    // Mark as manually closed
    this.manuallyClosed = true;

    // Hide the tooltip
    this.content.style.display = "none";
  };

  constructor(ctx: Ctx) {
    this.ctx = ctx;
    this.content = document.createElement("div");
    this.content.classList.add("milkdown-color-picker");

    this.colorPicker = document.createElement("input");
    this.colorPicker.type = "color";
    this.colorPicker.value = DEFAULT_COLOR;
    this.colorPicker.addEventListener("change", this.listener);

    this.closeButton = document.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.innerHTML = "×";
    this.closeButton.classList.add("milkdown-color-picker-close");
    this.closeButton.title = "Close";
    this.closeButton.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.closeHandler(e);
    });

    this.content.appendChild(this.colorPicker);
    this.content.appendChild(this.closeButton);

    this.provider = new TooltipProvider({
      content: this.content,
      floatingUIOptions: {
        placement: "right",
      },
      shouldShow: () => {
        const view = ctx.get(editorViewCtx);
        if (!view.state) return false;
        const { doc, selection } = view.state;
        const { from, to } = selection;
        const isEmptyTextBlock =
          !doc.textBetween(from, to).length &&
          selection instanceof TextSelection;

        if (isEmptyTextBlock) {
          return false;
        }

        const markType = markSchema.type(ctx);
        if (!markType) {
          return false;
        }

        let hasMark = false;
        doc.nodesBetween(from, to, (node) => {
          if (markType.isInSet(node.marks)) {
            hasMark = true;
            this.currentMark =
              node.marks.find((m) => m.type === markType) ?? null;
            return false;
          }
          return true;
        });

        // If manually closed, check if the selection has changed
        if (this.manuallyClosed) {
          const currentSelectionHash = `${from}-${to}`;
          if (currentSelectionHash !== this.lastClosedSelectionHash) {
            // Selection changed, reset the flag
            this.manuallyClosed = false;
            this.content.style.display = "";
            this.lastClosedSelectionHash = "";
          } else {
            // Same selection, keep it hidden
            return false;
          }
        }

        return hasMark;
      },
    });

    this.provider.onShow = () => {
      const color = this.currentMark?.attrs.color;
      this.colorPicker.value = color ?? DEFAULT_COLOR;
    };
  }

  update(updatedView: EditorView, prevState: EditorState) {
    this.provider.update(updatedView, prevState);
  }

  destroy() {
    this.provider.destroy();
    this.colorPicker.removeEventListener("change", this.listener);
    this.content.remove();
    this.colorPicker.remove();
    this.closeButton.remove();
  }
}

export const colorPickerTooltip = tooltipFactory("color-picker");

export const colorPickerTooltipConfig = (ctx: Ctx) => {
  ctx.set(colorPickerTooltip.key, {
    view: () => new TooltipPluginView(ctx),
  });
};
