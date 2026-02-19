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

  // Get all files (not folders) and sort by modified date
  const recentDocuments = () => {
    return props.documents
      .filter((doc) => doc.type === "file")
      .sort((a, b) => {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      })
      .slice(0, 10); // Show top 10 most recent
  };

  // Get favorite documents
  const favoriteDocuments = () => {
    return props.documents
      .filter((doc) => doc.type === "file" && doc.favorite)
      .sort((a, b) => {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      });
  };

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

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".md")) return "i-carbon-document";
    if (fileName.endsWith(".txt")) return "i-carbon-document-blank";
    return "i-carbon-document";
  };

  const colorClasses: Record<string, string> = {
    red: "border-l-red-500",
    orange: "border-l-orange-500",
    yellow: "border-l-yellow-500",
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    pink: "border-l-pink-500",
  };

  return (
    <div class="flex-1 overflow-auto p-8 bg-neutral-900 dark:bg-neutral-900 light:bg-neutral-50">
      <div class="max-w-4xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-neutral-100 dark:text-neutral-100 light:text-neutral-900 mb-2">
            Homepage
          </h1>
          <p class="text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
            {currentOrg() ? `${currentOrg()!.name} - ` : ""}Welcome back! Here
            are your recently edited documents.
          </p>
        </div>

        {/* Stats Cards */}
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div class="bg-neutral-800/50 dark:bg-neutral-800/50 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg p-4 light:shadow-sm">
            <div class="flex items-center gap-3">
              <div class="i-carbon-document w-8 h-8 dark:text-blue-500 light:text-blue-600" />
              <div>
                <div class="text-2xl font-bold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
                  {props.documents.filter((d) => d.type === "file").length}
                </div>
                <div class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
                  Documents
                </div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-800/50 dark:bg-neutral-800/50 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg p-4 light:shadow-sm">
            <div class="flex items-center gap-3">
              <div class="i-carbon-folder w-8 h-8 dark:text-amber-500 light:text-amber-500" />
              <div>
                <div class="text-2xl font-bold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
                  {props.documents.filter((d) => d.type === "folder").length}
                </div>
                <div class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
                  Folders
                </div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-800/50 dark:bg-neutral-800/50 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg p-4 light:shadow-sm">
            <div class="flex items-center gap-3">
              <div class="i-carbon-star-filled w-8 h-8 dark:text-yellow-400 light:text-yellow-500" />
              <div>
                <div class="text-2xl font-bold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
                  {favoriteDocuments().length}
                </div>
                <div class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
                  Favorites
                </div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-800/50 dark:bg-neutral-800/50 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg p-4 light:shadow-sm">
            <div class="flex items-center gap-3">
              <div class="i-carbon-time w-8 h-8 dark:text-green-500 light:text-green-600" />
              <div>
                <div class="text-2xl font-bold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
                  {recentDocuments().length > 0
                    ? formatDate(recentDocuments()[0].modified)
                    : "N/A"}
                </div>
                <div class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
                  Last edited
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Favorite Documents */}
        <Show when={favoriteDocuments().length > 0}>
          <div class="bg-neutral-800/50 dark:bg-neutral-800/50 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg overflow-hidden mb-8 light:shadow-md">
            <div class="px-6 py-4 border-b border-neutral-700 dark:border-neutral-700 light:border-neutral-200 flex items-center gap-2">
              <div class="i-carbon-star-filled w-5 h-5 text-yellow-400" />
              <h2 class="text-lg font-semibold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
                Favorite Documents
              </h2>
            </div>
            <div class="divide-y divide-neutral-700 dark:divide-neutral-700 light:divide-neutral-200">
              <For each={favoriteDocuments()}>
                {(doc) => (
                  <button
                    onClick={() => props.onSelectDocument(doc.path)}
                    class={`w-full px-6 py-4 flex items-center cursor-pointer gap-4 hover:bg-neutral-800 dark:hover:bg-neutral-800 light:hover:bg-neutral-50 transition-colors text-left border-l-4 ${
                      doc.color
                        ? colorClasses[doc.color] || "border-l-transparent"
                        : "border-l-transparent"
                    }`}
                  >
                    <div
                      class={`${getFileIcon(doc.name)} w-6 h-6 text-neutral-400 dark:text-neutral-400 light:text-neutral-500`}
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-neutral-100 dark:text-neutral-100 light:text-neutral-900 font-medium truncate flex items-center gap-2">
                        {getDisplayName(doc.name)}
                        <div class="i-carbon-star-filled w-4 h-4 text-yellow-400" />
                      </div>
                      <div class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600 truncate">
                        {getDisplayName(doc.path)}
                      </div>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-500 light:text-neutral-600">
                      <span>{formatSize(doc.size)}</span>
                      <span class="min-w-20 text-right">
                        {formatDate(doc.modified)}
                      </span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Recent Documents */}
        <div class="bg-neutral-800/50 dark:bg-neutral-800/50 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg overflow-hidden light:shadow-md">
          <div class="px-6 py-4 border-b border-neutral-700 dark:border-neutral-700 light:border-neutral-200">
            <h2 class="text-lg font-semibold text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
              Recent Documents
            </h2>
          </div>

          <Show
            when={recentDocuments().length > 0}
            fallback={
              <div class="px-6 py-12 text-center text-neutral-500 dark:text-neutral-500 light:text-neutral-600">
                <div class="i-carbon-document-blank w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No documents yet. Create one to get started!</p>
              </div>
            }
          >
            <div class="divide-y divide-neutral-700 dark:divide-neutral-700 light:divide-neutral-200">
              <For each={recentDocuments()}>
                {(doc) => (
                  <button
                    onClick={() => props.onSelectDocument(doc.path)}
                    class={`w-full px-6 py-4 flex items-center cursor-pointer gap-4 hover:bg-neutral-800 dark:hover:bg-neutral-800 light:hover:bg-neutral-50 transition-colors text-left`}
                  >
                    <div
                      class={`${getFileIcon(doc.name)} w-6 h-6 text-neutral-400 dark:text-neutral-400 light:text-neutral-500`}
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-neutral-100 dark:text-neutral-100 light:text-neutral-900 font-medium truncate">
                        {getDisplayName(doc.name)}
                      </div>
                      <div class="text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600 truncate">
                        {getDisplayName(doc.path)}
                      </div>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-500 light:text-neutral-600">
                      <span>{formatSize(doc.size)}</span>
                      <span class="min-w-20 text-right">
                        {formatDate(doc.modified)}
                      </span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
