import { JSX, Show } from "solid-js";
import PageHeader from "./PageHeader";

interface DocumentListPageProps {
  title: string;
  icon?: string;
  loading?: boolean;
  onBack: () => void;
  emptyState?: JSX.Element;
  children: JSX.Element;
  headerAction?: () => JSX.Element;
}

/**
 * Shared layout for list-style document pages (Archive, Deleted, etc.).
 * Handles the back-navigation header, loading spinner, and empty/content states.
 */
export default function DocumentListPage(props: DocumentListPageProps) {
  return (
    <div class="min-h-screen bg-surface">
      <PageHeader
        title={props.title}
        onBack={props.onBack}
        action={props.headerAction?.()}
      />
      <div class="max-w-5xl mx-auto px-6 py-8">
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
    </div>
  );
}
