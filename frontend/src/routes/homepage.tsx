import { useAppLayout } from "~/components/AppLayout";
import Homepage from "~/components/Homepage";
import { useNavigate } from "@solidjs/router";

export default function HomePageRoute() {
  const navigate = useNavigate();
  const { allDocuments } = useAppLayout();

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
