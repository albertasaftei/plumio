import { createSignal, onMount } from "solid-js";
import Homepage from "~/components/Homepage";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import { routes } from "~/routes";

export default function HomePageRoute() {
  const navigate = useNavigate();
  const [allDocuments, setAllDocuments] = createSignal<Document[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Load all documents recursively
  const loadAllDocuments = async () => {
    const loadFolder = async (path: string): Promise<Document[]> => {
      const result = await api.listDocuments(path);
      const items: Document[] = [];

      for (const item of result.items) {
        items.push(item);
        if (item.type === "folder") {
          const children = await loadFolder(item.path);
          items.push(...children);
        }
      }
      return items;
    };

    setLoading(true);
    try {
      const items = await loadFolder("/");
      setAllDocuments(items);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    // Validate session first
    const isValid = await api.validateSession();
    if (!isValid) {
      navigate(routes.login);
      return;
    }

    await loadAllDocuments();
  });

  return (
    <Homepage
      documents={allDocuments()}
      onSelectDocument={(path) => {
        // Encode the path to handle spaces and special characters
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        navigate(`/file${encodedPath}`);
      }}
    />
  );
}
