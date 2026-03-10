import type { Theme } from "~/lib/theme";
import { THEME_META } from "~/lib/theme";

interface ThemeSwatchProps {
  id: Theme;
  isActive: boolean;
  onSelect: (id: Theme) => void;
}

export default function ThemeSwatch(props: ThemeSwatchProps) {
  const meta = THEME_META[props.id];
  const [bg, surface, accent] = meta.swatches;

  return (
    <button
      onClick={() => props.onSelect(props.id)}
      aria-label={`Select ${meta.label} theme`}
      aria-pressed={props.isActive}
      class="flex flex-col items-center gap-2 rounded-xl p-2 border-2 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      style={{
        "border-color": props.isActive
          ? "var(--color-primary)"
          : "var(--color-border)",
        "background-color": props.isActive
          ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
          : "transparent",
      }}
    >
      {/* Mini app preview */}
      <div
        class="w-full rounded-lg overflow-hidden"
        style={{ "aspect-ratio": "4/3", "background-color": bg }}
      >
        <div class="flex h-full">
          {/* Sidebar strip */}
          <div
            class="w-1/3 h-full flex flex-col gap-1 p-1"
            style={{ "background-color": surface }}
          >
            <div
              class="rounded-sm h-1.5"
              style={{ "background-color": accent, opacity: "0.8" }}
            />
            <div
              class="rounded-sm h-1"
              style={{
                "background-color": `color-mix(in srgb, ${accent} 30%, transparent)`,
              }}
            />
            <div
              class="rounded-sm h-1"
              style={{
                "background-color": `color-mix(in srgb, ${accent} 15%, transparent)`,
              }}
            />
          </div>
          {/* Content area */}
          <div class="flex-1 flex flex-col gap-1 p-1.5">
            <div
              class="rounded-sm h-1.5 w-3/4"
              style={{
                "background-color": `color-mix(in srgb, ${accent} 70%, transparent)`,
              }}
            />
            <div
              class="rounded-sm h-1 w-full"
              style={{
                "background-color": `color-mix(in srgb, ${accent} 20%, transparent)`,
              }}
            />
            <div
              class="rounded-sm h-1 w-5/6"
              style={{
                "background-color": `color-mix(in srgb, ${accent} 15%, transparent)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Label */}
      <span
        class="text-xs font-medium transition-colors"
        style={{
          color: props.isActive
            ? "var(--color-primary)"
            : "var(--color-text-secondary)",
        }}
      >
        {meta.label}
      </span>

      {/* Active dot */}
      {props.isActive && (
        <span
          class="w-1.5 h-1.5 rounded-full"
          style={{ "background-color": "var(--color-primary)" }}
        />
      )}
    </button>
  );
}
