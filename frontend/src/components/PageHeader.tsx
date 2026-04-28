import { JSX, Show } from "solid-js";
import Button from "./Button";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  onBack?: () => void;
  action?: JSX.Element;
}

export default function PageHeader(props: PageHeaderProps) {
  return (
    <div class="border-b border-subtle bg-base sticky top-0 z-10">
      <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <Show when={props.onBack}>
            <Button
              variant="icon"
              size="md"
              onClick={props.onBack}
              title="Go back"
            >
              <div class="i-carbon-arrow-left w-5 h-5" />
            </Button>
          </Show>
          <Show when={props.icon}>
            <div
              class={`${props.icon} w-6 h-6 text-muted-body flex-shrink-0`}
            />
          </Show>
          <div>
            <h1 class="text-xl font-semibold text-body">{props.title}</h1>
            <Show when={props.subtitle}>
              <p class="text-sm text-muted-body">{props.subtitle}</p>
            </Show>
          </div>
        </div>
        <Show when={props.action}>{props.action}</Show>
      </div>
    </div>
  );
}
