import { For, Show, createSignal, onMount } from "solid-js";
import { api, type Document } from "~/lib/api";
import { getDisplayName } from "~/utils/document.utils";

interface HomepageProps {
  documents: Document[];
  onSelectDocument: (path: string) => void;
}

export default function Homepage(props: HomepageProps) {
  const [currentOrg, setCurrentOrg] = createSignal<{
    id: number;
    name: string;
    slug: string;
    role: string;
  } | null>(null);

  onMount(async () => {
    const currentOrg = await api.getCurrentOrganization();
    setCurrentOrg(currentOrg);
  });

  const recentDocuments = () => {
    return props.documents
      .filter((doc) => doc.type === "file")
      .sort((a, b) => {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      })
      .slice(0, 12);
  };

  const favoriteDocuments = () => {
    return props.documents
      .filter((doc) => doc.type === "file" && doc.favorite)
      .sort((a, b) => {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const todayLabel = () =>
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const accentColor: Record<string, string> = {
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };

  return (
    <div class="flex-1 overflow-auto bg-[var(--color-bg-base)]">
      {/* ── Header strip ─────────────────────────────────────────── */}
      <div class="border-b border-[var(--color-border)] px-4 sm:px-8 py-4 sm:py-5">
        <div class="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--color-text-muted)] mb-0.5">
              {greeting()}
            </p>
            <h1 class="text-xl font-semibold text-[var(--color-text-primary)] truncate">
              {currentOrg()?.name ?? "My Workspace"}
            </h1>
          </div>

          <div class="flex items-center gap-3 sm:gap-6 flex-wrap">
            {/* Inline stat pills */}
            <div class="flex items-center gap-1 text-[var(--color-text-muted)] text-sm">
              <div class="i-carbon-document w-3.5 h-3.5" />
              <span class="font-medium text-[var(--color-text-secondary)]">
                {props.documents.filter((d) => d.type === "file").length}
              </span>
              <span class="ml-0.5">docs</span>
            </div>
            <div class="w-px h-4 bg-[var(--color-border)]" />
            <div class="flex items-center gap-1 text-[var(--color-text-muted)] text-sm">
              <div class="i-carbon-folder w-3.5 h-3.5" />
              <span class="font-medium text-[var(--color-text-secondary)]">
                {props.documents.filter((d) => d.type === "folder").length}
              </span>
              <span class="ml-0.5">folders</span>
            </div>
            <div class="w-px h-4 bg-[var(--color-border)]" />
            <div class="flex items-center gap-1 text-[var(--color-text-muted)] text-sm">
              <div class="i-carbon-star-filled w-3.5 h-3.5 text-yellow-400" />
              <span class="font-medium text-[var(--color-text-secondary)]">
                {favoriteDocuments().length}
              </span>
              <span class="ml-0.5">starred</span>
            </div>
            <div class="hidden sm:block w-px h-4 bg-[var(--color-border)]" />
            <span class="hidden sm:inline text-sm text-[var(--color-text-muted)]">
              {todayLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div class="max-w-5xl mx-auto px-4 sm:px-8 py-5 sm:py-7">
        <Show
          when={favoriteDocuments().length > 0}
          fallback={
            /* No favorites — full-width recents */
            <RecentSection
              docs={recentDocuments()}
              onSelect={props.onSelectDocument}
              formatDate={formatDate}
              formatSize={formatSize}
            />
          }
        >
          {/* Two-column layout — stacks on mobile, side-by-side on lg+ */}
          <div
            class="flex flex-col gap-6 lg:grid lg:gap-8"
            style="grid-template-columns: 1fr 260px"
          >
            {/* Favorites — first in DOM so it appears on top on mobile; pushed to right column on desktop via order */}
            <aside class="order-first lg:order-last">
              <SectionLabel icon="i-carbon-star-filled" label="Pinned" />
              <div class="flex flex-col gap-2">
                <For each={favoriteDocuments()}>
                  {(doc) => {
                    const color = doc.color
                      ? accentColor[doc.color]
                      : "var(--color-text-muted)";
                    return (
                      <button
                        onClick={() => props.onSelectDocument(doc.path)}
                        class="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] transition-colors overflow-hidden"
                        style={`border-left: 3px solid ${color}`}
                      >
                        <div class="px-3 py-3">
                          <div class="flex items-start justify-between gap-2 mb-1">
                            <span class="text-sm font-medium text-[var(--color-text-primary)] truncate leading-snug">
                              {getDisplayName(doc.name)}
                            </span>
                            <div class="i-carbon-star-filled w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                          </div>
                          <div class="flex items-center justify-between mt-1">
                            <Show
                              when={parentFolder(doc.path)}
                              fallback={
                                <span class="text-[11px] text-[var(--color-text-muted)]">
                                  Root
                                </span>
                              }
                            >
                              <span class="text-[11px] text-[var(--color-text-muted)] truncate flex items-center gap-1">
                                <div class="i-carbon-folder w-3 h-3 shrink-0" />
                                {parentFolder(doc.path)}
                              </span>
                            </Show>
                            <span class="text-[11px] text-[var(--color-text-muted)] shrink-0 ml-2">
                              {formatDate(doc.modified)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </aside>

            {/* Left — recents */}
            <RecentSection
              docs={recentDocuments()}
              onSelect={props.onSelectDocument}
              formatDate={formatDate}
              formatSize={formatSize}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

/** Returns the parent directory of a path, or null if at root. */
function parentFolder(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(" / ");
}

/* ── Sub-components ──────────────────────────────────────────────── */

function SectionLabel(props: { icon: string; label: string }) {
  return (
    <div class="flex items-center gap-2 mb-4">
      <div class={`${props.icon} w-3.5 h-3.5 text-[var(--color-text-muted)]`} />
      <span class="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--color-text-muted)]">
        {props.label}
      </span>
      <div class="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function RecentSection(props: {
  docs: ReturnType<typeof Array.prototype.filter>;
  onSelect: (path: string) => void;
  formatDate: (d: string) => string;
  formatSize: (b: number) => string;
}) {
  return (
    <section>
      <SectionLabel icon="i-carbon-recently-viewed" label="Recently edited" />
      <Show
        when={props.docs.length > 0}
        fallback={
          <div class="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
            <div class="i-carbon-document-blank w-10 h-10 mb-3 opacity-20" />
            <p class="text-sm">No documents yet. Create one to get started!</p>
          </div>
        }
      >
        <div class="rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-surface)]">
          {/* Table header — hide # and Size on mobile */}
          <div
            class="grid text-[11px] font-semibold tracking-wide uppercase text-[var(--color-text-muted)] px-4 py-2 border-b border-[var(--color-border)]"
            style="grid-template-columns: 1fr auto auto"
          >
            <span>Name</span>
            <span class="hidden sm:block text-right pr-6">Size</span>
            <span class="text-right w-20">Modified</span>
          </div>

          <For each={props.docs}>
            {(doc, i) => (
              <button
                onClick={() => props.onSelect((doc as any).path)}
                class="w-full text-left grid items-center gap-0 px-4 py-3 hover:bg-[var(--color-bg-elevated)] transition-colors border-b border-[var(--color-border)] last:border-b-0 cursor-pointer"
                style="grid-template-columns: 1fr auto auto"
              >
                {/* Name + path */}
                <div class="min-w-0">
                  <div class="text-sm font-medium text-[var(--color-text-primary)] truncate flex items-center gap-1.5">
                    <div class="i-carbon-document w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                    {getDisplayName((doc as any).name)}
                    <Show when={(doc as any).favorite}>
                      <div class="i-carbon-star-filled w-3 h-3 text-yellow-400 shrink-0" />
                    </Show>
                  </div>
                  <Show
                    when={parentFolder((doc as any).path)}
                    fallback={
                      <div class="text-[11px] text-[var(--color-text-muted)] mt-0.5 pl-5 flex items-center gap-1">
                        <div class="i-carbon-folder-open w-3 h-3 shrink-0" />
                        <span>Root</span>
                      </div>
                    }
                  >
                    <div class="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5 pl-5 flex items-center gap-1">
                      <div class="i-carbon-folder w-3 h-3 shrink-0" />
                      <span>{parentFolder((doc as any).path)}</span>
                    </div>
                  </Show>
                </div>

                {/* Size — hidden on mobile */}
                <span
                  class="hidden sm:block text-xs text-[var(--color-text-muted)] text-right pr-6 font-mono"
                  style="font-variant-numeric: tabular-nums"
                >
                  {props.formatSize((doc as any).size)}
                </span>

                {/* Date */}
                <span
                  class="text-xs text-[var(--color-text-muted)] text-right w-20 shrink-0"
                  style="font-variant-numeric: tabular-nums"
                >
                  {props.formatDate((doc as any).modified)}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
