import { createSignal, onMount } from "solid-js";
import Homepage from "~/components/Homepage";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import { routes } from "~/routes";
import type { Tag } from "~/types/Tag.types";
import { useAppLayout } from "~/components/AppLayout";

export default function HomePageRoute() {
  const navigate = useNavigate();
  const { allDocuments } = useAppLayout();
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [tagMappings, setTagMappings] = createSignal<Record<string, number[]>>(
    {},
  );

  onMount(async () => {
    // Session validation and document loading are handled by AppLayout.
    // Fetch only what the homepage needs beyond the document tree.
    const session = await api.validateSession();
    if (!session.valid) {
      navigate(routes.login);
      return;
    }

    await Promise.all([
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
