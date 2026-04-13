import { JSX, Show } from "solid-js";

interface DocumentListPageProps {
  title: string;
  icon: string;
  loading: boolean;
  onBack: () => void;
  emptyState: JSX.Element;
  children: JSX.Element;
  headerAction?: () => JSX.Element;
}

/**
 * Shared layout for list-style document pages (Archive, Deleted, etc.).
 * Handles the back-navigation header, loading spinner, and empty/content states.
 */
export default function DocumentListPage(props: DocumentListPageProps) {
  return (
    <div class="flex flex-col w-full overflow-auto lg:max-w-5xl mx-auto p-4 sm:p-8">
      {/* Page header */}
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <div class="flex items-center">
            <button
              onClick={props.onBack}
              class="p-2 rounded-lg text-muted-body hover:text-body hover:bg-elevated transition-colors cursor-pointer"
              title="Go back"
            >
              <div class="i-carbon-arrow-left w-5 h-5" />
            </button>
            <div class={`${props.icon} w-8 h-8 text-muted-body ml-1`} />
          </div>
          <h1 class="text-2xl sm:text-3xl font-bold text-body">
            {props.title}
          </h1>
        </div>
        {props.headerAction?.()}
      </div>

      {/* Content */}
      <Show
        when={!props.loading}
        fallback={
          <div class="flex justify-center py-12">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-muted-body" />
          </div>
        }
      >
        {props.children}
      </Show>
    </div>
  );
}
