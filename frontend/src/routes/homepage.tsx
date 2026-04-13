import { createSignal, onMount } from "solid-js";
import Homepage from "~/components/Homepage";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import { routes } from "~/routes";
import type { Tag } from "~/types/Tag.types";

export default function HomePageRoute() {
  const navigate = useNavigate();
  const [allDocuments, setAllDocuments] = createSignal<Document[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [tagMappings, setTagMappings] = createSignal<Record<string, number[]>>(
    {},
  );

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

    await Promise.all([
      loadAllDocuments(),
      api
        .listTags()
        .then((r) => setTags(r.tags))
        .catch(() => {}),
      api
        .getTagMappings()
        .then((r) => setTagMappings(r.mappings))
        .catch(() => {}),
    ]);
  });

  return (
    <Homepage
      documents={allDocuments()}
      tags={tags()}
      tagMappings={tagMappings()}
      onSelectDocument={(path) => {
        // Encode the path to handle spaces and special characters
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        navigate(`/file${encodedPath}`);
      }}
    />
  );
}
