import { Show } from "solid-js";
import Button from "./Button";
import Logo from "./Logo";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onDashboard: () => void;
}

export default function Header(props: HeaderProps) {
  return (
    <header class="h-14 border-b border-neutral-800 dark:border-neutral-800 light:border-neutral-200 flex items-center justify-between px-2 sm:px-4 bg-neutral-950 dark:bg-neutral-950 light:bg-white">
      <div class="flex items-center gap-1 sm:gap-2">
        <Show when={!props.sidebarOpen}>
          <Button
            onClick={props.onToggleSidebar}
            variant="icon"
            size="lg"
            aria-label="Open sidebar"
          >
            <div class="i-carbon-side-panel-open w-5 h-5" />
          </Button>
        </Show>
        <Button
          onClick={props.onDashboard}
          variant="ghost"
          size="lg"
          class="flex items-center gap-1 sm:gap-2"
          title="Go to Dashboard"
        >
          <Logo color="#2a9d8f" />
          <h1 class="hidden sm:block text-lg font-semibold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
            plumio
          </h1>
        </Button>
      </div>
    </header>
  );
}
