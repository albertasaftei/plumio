import {
  createSignal,
  For,
  Show,
  onMount,
  onCleanup,
  createEffect,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import PageHeader from "~/components/PageHeader";
import { routes } from "~/routes";
import { getDisplayName } from "~/utils/document.utils";
import { formatDayRelativeDate } from "~/utils/date.utils";
import DocumentListPage from "~/components/DocumentListPage";
import { useI18n } from "~/i18n";

interface SearchResult {
  path: string;
  title: string;
  color: string | null;
  modified: string;
  size: number;
  snippet: string;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searched, setSearched] = createSignal(false);

  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout>;

  onMount(async () => {
    const session = await api.validateSession();
    if (!session.valid) {
      navigate(routes.login);
      return;
    }
    // Auto-focus the input
    setTimeout(() => inputRef?.focus(), 0);
  });

  onCleanup(() => clearTimeout(debounceTimer));

  const performSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.searchDocuments(trimmed);
      setResults(data.results);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const q = query();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(q), 300);
  });

  const handleSelect = (path: string) => {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    navigate(`/file${encodedPath}`);
  };

  return (
    <DocumentListPage
      title={t("search.title")}
      onBack={() => navigate(routes.homepage)}
    >
      {/* Search Input */}
      <div class="relative mb-6">
        <div class="absolute left-4 top-1/2 -translate-y-1/2 i-carbon-search w-5 h-5 text-muted-body pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={t("search.placeholder")}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          class="focus-ring w-full pl-12 pr-4 py-3 bg-elevated border border-base rounded-lg text-body placeholder-neutral-500 dark:placeholder-neutral-500 light:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-base transition-shadow"
        />
        <Show when={query()}>
          <button
            onClick={() => setQuery("")}
            class="absolute right-4 top-1/2 -translate-y-1/2 i-carbon-close w-4 h-4 text-muted-body hover:text-body transition-colors"
            aria-label="Clear search"
          />
        </Show>
      </div>

      {/* Loading */}
      <Show when={loading()}>
        <div class="flex justify-center py-12">
          <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-muted-body" />
        </div>
      </Show>

      {/* Empty state before any search */}
      <Show when={!loading() && !searched()}>
        <div class="text-center py-16 text-muted-body select-none">
          <div class="i-carbon-search w-16 h-16 mx-auto mb-4 opacity-20" />
          <p class="text-base">{t("search.emptyHint")}</p>
        </div>
      </Show>

      {/* No results */}
      <Show when={!loading() && searched() && results().length === 0}>
        <div class="text-center py-16 text-muted-body select-none">
          <div class="i-carbon-document-unknown w-16 h-16 mx-auto mb-4 opacity-30" />
          <p class="text-base font-medium">{t("search.noResults", { query: query() })}</p>
          <p class="text-sm mt-1 opacity-70">
            {t("search.noResultsHint")}
          </p>
        </div>
      </Show>

      {/* Results */}
      <Show when={!loading() && results().length > 0}>
        <p class="text-xs text-muted-body mb-3">
          {results().length === 1
            ? t("search.resultsCount", { count: String(results().length), query: query() })
            : t("search.resultsCountPlural", { count: String(results().length), query: query() })}
        </p>
        <div class="space-y-2">
          <For each={results()}>
            {(result) => (
              <button
                onClick={() => handleSelect(result.path)}
                class="w-full text-left bg-surface border border-base hover:bg-elevated rounded-lg p-4 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              >
                {/* Title row */}
                <div class="flex items-center gap-3 mb-2">
                  <div class="i-carbon-document w-4 h-4 text-secondary-body flex-shrink-0" />
                  <span class="font-medium text-body truncate group-hover:text-body transition-colors">
                    {getDisplayName(result.path)}
                  </span>
                  <span class="ml-auto text-xs text-muted-body flex-shrink-0">
                    {formatDayRelativeDate(result.modified)}
                  </span>
                </div>

                {/* Snippet */}
                <Show when={result.snippet}>
                  <p
                    class="text-sm text-secondary-body leading-relaxed line-clamp-3 pl-7 [&_mark]:bg-yellow-400/30 [&_mark]:text-yellow-200 dark:[&_mark]:text-yellow-200 light:[&_mark]:bg-yellow-200 light:[&_mark]:text-yellow-900 [&_mark]:rounded-sm [&_mark]:px-0.5"
                    // Safe: document content is HTML-escaped (& <Show >) before FTS insertion.
                    // SQLite's snippet() only adds literal <mark>…</mark> around matches.
                    innerHTML={result.snippet}
                  />
                </Show>

                {/* Path breadcrumb for nested files */}
                <Show when={result.path.split("/").length > 2}>
                  <p class="text-xs text-muted-body mt-1.5 pl-7 truncate">
                    {result.path.split("/").slice(1, -1).join(" / ")}
                  </p>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </DocumentListPage>
  );
}
