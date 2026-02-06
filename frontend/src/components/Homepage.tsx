import { For, Show, createSignal, onMount } from "solid-js";
import { api, type Document } from "~/lib/api";

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
    <div class="flex-1 overflow-auto p-8 bg-neutral-900">
      <div class="max-w-4xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-neutral-100 mb-2">Homepage</h1>
          <p class="text-neutral-400">
            {currentOrg() ? `${currentOrg()!.name} - ` : ""}Welcome back! Here
            are your recently edited documents.
          </p>
        </div>

        {/* Stats Cards */}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div class="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <div class="i-carbon-document w-8 h-8 text-blue-500" />
              <div>
                <div class="text-2xl font-bold text-neutral-100">
                  {props.documents.filter((d) => d.type === "file").length}
                </div>
                <div class="text-sm text-neutral-400">Documents</div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <div class="i-carbon-folder w-8 h-8 text-yellow-500" />
              <div>
                <div class="text-2xl font-bold text-neutral-100">
                  {props.documents.filter((d) => d.type === "folder").length}
                </div>
                <div class="text-sm text-neutral-400">Folders</div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <div class="i-carbon-time w-8 h-8 text-green-500" />
              <div>
                <div class="text-2xl font-bold text-neutral-100">
                  {recentDocuments().length > 0
                    ? formatDate(recentDocuments()[0].modified)
                    : "N/A"}
                </div>
                <div class="text-sm text-neutral-400">Last edited</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div class="bg-neutral-800/50 border border-neutral-700 rounded-lg overflow-hidden">
          <div class="px-6 py-4 border-b border-neutral-700">
            <h2 class="text-lg font-semibold text-neutral-100">
              Recent Documents
            </h2>
          </div>

          <Show
            when={recentDocuments().length > 0}
            fallback={
              <div class="px-6 py-12 text-center text-neutral-500">
                <div class="i-carbon-document-blank w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No documents yet. Create one to get started!</p>
              </div>
            }
          >
            <div class="divide-y divide-neutral-700">
              <For each={recentDocuments()}>
                {(doc) => (
                  <button
                    onClick={() => props.onSelectDocument(doc.path)}
                    class={`w-full px-6 py-4 flex items-center cursor-pointer gap-4 hover:bg-neutral-800 transition-colors text-left`}
                  >
                    <div
                      class={`${getFileIcon(doc.name)} w-6 h-6 text-neutral-400`}
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-neutral-100 font-medium truncate">
                        {doc.name}
                      </div>
                      <div class="text-sm text-neutral-400 truncate">
                        {doc.path}
                      </div>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-neutral-500">
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
