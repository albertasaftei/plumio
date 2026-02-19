import { For, Show } from "solid-js";
import { COLOR_PALETTE } from "~/utils/sidebar.utils";
import Button from "./Button";

interface ColorPickerProps {
  currentColor?: string;
  onColorSelect: (color: string | null) => void;
}

export default function ColorPicker(props: ColorPickerProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      class="px-3 py-2 border-t border-neutral-800 dark:border-neutral-800 light:border-neutral-300"
    >
      <div class="text-xs text-neutral-500 dark:text-neutral-500 light:text-neutral-600 mb-2">
        Color
      </div>
      <div class="flex flex-wrap gap-1">
        <For each={COLOR_PALETTE}>
          {(color) => (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                props.onColorSelect(color.value);
              }}
              variant="icon"
              size="sm"
              class="w-5 h-5 rounded-sm border-2 hover:scale-110 transition-transform"
              style={{
                "background-color": color.value,
                "border-color":
                  props.currentColor === color.value ? "#fff" : "transparent",
              }}
              title={color.name}
            />
          )}
        </For>
        <Show when={props.currentColor}>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              props.onColorSelect(null);
            }}
            variant="icon"
            size="sm"
            class="w-5 h-5 rounded-sm border-2 border-neutral-700 dark:border-neutral-700 light:border-neutral-400 hover:scale-110 transition-transform flex items-center justify-center"
            title="Remove color"
          >
            <div class="i-carbon-close w-3 h-3 text-neutral-500 dark:text-neutral-500 light:text-neutral-600" />
          </Button>
        </Show>
      </div>
    </div>
  );
}
