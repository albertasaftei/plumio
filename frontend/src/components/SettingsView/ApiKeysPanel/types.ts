export type ApiKey = {
  id: number;
  user_id: number;
  name: string;
  key_prefix: string;
  permissions: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

export type CreateApiKeyPayload = {
  name: string;
  permissions: string[];
  expires_at?: string | null;
};

export const PERMISSIONS = [
  "documents:read",
  "documents:create",
  "documents:update",
  "documents:delete",
  "folders:read",
  "folders:create",
  "folders:update",
  "folders:delete",
  "tags:read",
  "tags:create",
  "tags:update",
  "tags:delete",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: {
  resource: string;
  labelKey: string;
  permissions: Permission[];
}[] = [
  {
    resource: "documents",
    labelKey: "apiKeys.groupDocuments",
    permissions: [
      "documents:read",
      "documents:create",
      "documents:update",
      "documents:delete",
    ],
  },
  {
    resource: "folders",
    labelKey: "apiKeys.groupFolders",
    permissions: [
      "folders:read",
      "folders:create",
      "folders:update",
      "folders:delete",
    ],
  },
  {
    resource: "tags",
    labelKey: "apiKeys.groupTags",
    permissions: ["tags:read", "tags:create", "tags:update", "tags:delete"],
  },
];

export const PERMISSION_LABEL_KEYS: Record<Permission, string> = {
  "documents:read": "apiKeys.permDocumentsRead",
  "documents:create": "apiKeys.permDocumentsCreate",
  "documents:update": "apiKeys.permDocumentsUpdate",
  "documents:delete": "apiKeys.permDocumentsDelete",
  "folders:read": "apiKeys.permFoldersRead",
  "folders:create": "apiKeys.permFoldersCreate",
  "folders:update": "apiKeys.permFoldersUpdate",
  "folders:delete": "apiKeys.permFoldersDelete",
  "tags:read": "apiKeys.permTagsRead",
  "tags:create": "apiKeys.permTagsCreate",
  "tags:update": "apiKeys.permTagsUpdate",
  "tags:delete": "apiKeys.permTagsDelete",
};
