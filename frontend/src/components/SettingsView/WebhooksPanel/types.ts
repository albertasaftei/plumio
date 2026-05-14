export type Webhook = {
  id: number;
  org_id: number;
  name: string;
  url: string;
  events: string[];
  active: number;
  created_at: string;
  created_by: number;
};

export type Delivery = {
  id: number;
  webhook_id: number;
  event: string;
  status: "success" | "failed" | "pending";
  response_status: number | null;
  attempts: number;
  delivered_at: string | null;
  created_at: string;
};

export type FormState = {
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
};

export const ALL_EVENTS = [
  "document.created",
  "document.updated",
  "document.deleted",
  "document.renamed",
  "document.archived",
  "document.unarchived",
  "document.restored",
  "document.tagged",
  "document.untagged",
  "folder.created",
  "folder.deleted",
  "tag.created",
  "tag.updated",
  "tag.deleted",
] as const;

export const EVENT_GROUPS = [
  {
    label: "Documents",
    events: [
      "document.created",
      "document.updated",
      "document.deleted",
      "document.renamed",
      "document.archived",
      "document.unarchived",
      "document.restored",
      "document.tagged",
      "document.untagged",
    ],
  },
  {
    label: "Folders",
    events: ["folder.created", "folder.deleted"],
  },
  {
    label: "Tags",
    events: ["tag.created", "tag.updated", "tag.deleted"],
  },
] as const;
