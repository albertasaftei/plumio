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
import Button from "~/components/Button";
import { routes } from "~/routes";
import { getDisplayName } from "~/utils/document.utils";

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
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searched, setSearched] = createSignal(false);

  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout>;

  onMount(async () => {
    const isValid = await api.validateSession();
    if (!isValid) {
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div class="flex flex-col w-full overflow-auto lg:max-w-3xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div class="flex items-center mb-6 gap-4">
        <Button
          onClick={() => navigate(routes.homepage)}
          variant="ghost"
          size="md"
        >
          <div class="i-carbon-arrow-left w-5 h-5" />
        </Button>
        <div class="i-carbon-search w-8 h-8 text-neutral-400 dark:text-neutral-400 light:text-neutral-500" />
        <h1 class="text-2xl sm:text-3xl font-bold text-white dark:text-white light:text-neutral-900">
          Full-text Search
        </h1>
      </div>

      {/* Search Input */}
      <div class="relative mb-6">
        <div class="absolute left-4 top-1/2 -translate-y-1/2 i-carbon-search w-5 h-5 text-neutral-500 dark:text-neutral-500 light:text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search inside all documents…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          class="w-full pl-12 pr-4 py-3 bg-neutral-800 dark:bg-neutral-800 light:bg-white border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-xl text-neutral-100 dark:text-neutral-100 light:text-neutral-900 placeholder-neutral-500 dark:placeholder-neutral-500 light:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-base transition-shadow"
        />
        <Show when={query()}>
          <button
            onClick={() => setQuery("")}
            class="absolute right-4 top-1/2 -translate-y-1/2 i-carbon-close w-4 h-4 text-neutral-500 hover:text-neutral-300 dark:hover:text-neutral-300 light:hover:text-neutral-600 transition-colors"
            aria-label="Clear search"
          />
        </Show>
      </div>

      {/* Loading */}
      <Show when={loading()}>
        <div class="flex justify-center py-12">
          <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500 dark:text-neutral-500 light:text-neutral-400" />
        </div>
      </Show>

      {/* Empty state before any search */}
      <Show when={!loading() && !searched()}>
        <div class="text-center py-16 text-neutral-500 dark:text-neutral-500 light:text-neutral-500 select-none">
          <div class="i-carbon-search w-16 h-16 mx-auto mb-4 opacity-20" />
          <p class="text-base">Type to search inside all your documents</p>
        </div>
      </Show>

      {/* No results */}
      <Show when={!loading() && searched() && results().length === 0}>
        <div class="text-center py-16 text-neutral-500 dark:text-neutral-500 light:text-neutral-500 select-none">
          <div class="i-carbon-document-unknown w-16 h-16 mx-auto mb-4 opacity-30" />
          <p class="text-base font-medium">No results for "{query()}"</p>
          <p class="text-sm mt-1 opacity-70">
            Try different keywords or check your spelling
          </p>
        </div>
      </Show>

      {/* Results */}
      <Show when={!loading() && results().length > 0}>
        <p class="text-xs text-neutral-500 dark:text-neutral-500 light:text-neutral-500 mb-3">
          {results().length} result{results().length !== 1 ? "s" : ""} for "
          {query()}"
        </p>
        <div class="space-y-2">
          <For each={results()}>
            {(result) => (
              <button
                onClick={() => handleSelect(result.path)}
                class="w-full text-left bg-neutral-800 dark:bg-neutral-800 light:bg-neutral-50 hover:bg-neutral-750 dark:hover:bg-neutral-750 light:hover:bg-neutral-100 border border-transparent light:border-neutral-200 light:shadow-sm rounded-xl p-4 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              >
                {/* Title row */}
                <div class="flex items-center gap-3 mb-2">
                  <div class="i-carbon-document w-4 h-4 text-neutral-400 dark:text-neutral-400 light:text-neutral-500 flex-shrink-0" />
                  <span class="font-medium text-neutral-100 dark:text-neutral-100 light:text-neutral-900 truncate group-hover:text-white dark:group-hover:text-white light:group-hover:text-neutral-950 transition-colors">
                    {getDisplayName(result.path)}
                  </span>
                  <span class="ml-auto text-xs text-neutral-600 dark:text-neutral-600 light:text-neutral-500 flex-shrink-0">
                    {formatDate(result.modified)}
                  </span>
                </div>

                {/* Snippet */}
                <Show when={result.snippet}>
                  <p
                    class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600 leading-relaxed line-clamp-3 pl-7 [&_mark]:bg-yellow-400/30 [&_mark]:text-yellow-200 dark:[&_mark]:text-yellow-200 light:[&_mark]:bg-yellow-200 light:[&_mark]:text-yellow-900 [&_mark]:rounded-sm [&_mark]:px-0.5"
                    // Safe: document content is HTML-escaped (& < >) before FTS insertion.
                    // SQLite's snippet() only adds literal <mark>…</mark> around matches.
                    innerHTML={result.snippet}
                  />
                </Show>

                {/* Path breadcrumb for nested files */}
                <Show when={result.path.split("/").length > 2}>
                  <p class="text-xs text-neutral-600 dark:text-neutral-600 light:text-neutral-400 mt-1.5 pl-7 truncate">
                    {result.path.split("/").slice(1, -1).join(" / ")}
                  </p>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
