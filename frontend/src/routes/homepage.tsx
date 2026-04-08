import { createSignal, onMount } from "solid-js";
import Homepage from "~/components/Homepage";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import { routes } from "~/routes";

export default function HomePageRoute() {
  const navigate = useNavigate();
  const [allDocuments, setAllDocuments] = createSignal<Document[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Load all documents in a single recursive API call
  const loadAllDocuments = async () => {
    setLoading(true);
    try {
      const result = await api.listAllDocuments();
      setAllDocuments(result.items);
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
