export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_admin: number; // 1 = admin, 0 = regular user
  is_banned: number; // 1 = banned, 0 = active
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  owner_id: number;
  discoverable: number; // 1 = discoverable, 0 = hidden
  auto_accept: number; // 1 = auto-accept join requests, 0 = manual review
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: string;
  joined_at: string;
  username: string;
  email: string;
  is_banned: number; // 1 = banned, 0 = active
}

export interface Session {
  id: string;
  user_id: number;
  token: string;
  current_organization_id: number | null;
  expires_at: string;
  created_at: string;
}

export interface Document {
  id: number;
  organization_id: number;
  user_id: number;
  path: string;
  title: string;
  color: string | null;
  size: number;
  archived: number; // SQLite uses 0/1 for boolean
  archived_at: string | null;
  archived_by: number | null;
  deleted: number; // SQLite uses 0/1 for boolean
  deleted_at: string | null;
  deleted_by: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentMetadata {
  color?: string;
  favorite?: boolean;
}

export interface Tag {
  id: number;
  user_id: number;
  organization_id: number;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentTag {
  id: number;
  document_id: number;
  tag_id: number;
  created_at: string;
}

export interface JoinRequest {
  id: number;
  organization_id: number;
  user_id: number;
  status: "pending" | "accepted" | "rejected";
  message: string | null;
  reviewed_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface JoinRequestWithUser extends JoinRequest {
  username: string;
  email: string;
}

export interface JoinRequestWithOrg extends JoinRequest {
  org_name: string;
  org_slug: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  metadata: string | null;
  read: number;
  created_at: string;
}

export interface TagWithCount extends Tag {
  document_count: number;
}

export interface Webhook {
  id: number;
  org_id: number;
  name: string;
  url: string;
  secret: string;
  events: string; // JSON array stored as text
  active: number; // 1 = active, 0 = inactive
  created_at: string;
  created_by: number;
}

export interface WebhookDelivery {
  id: number;
  webhook_id: number;
  event: string;
  payload: string; // JSON stored as text
  status: "success" | "failed" | "pending";
  response_status: number | null;
  response_body: string | null;
  attempts: number;
  delivered_at: string | null;
  created_at: string;
}

export interface ApiKey {
  id: number;
  user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string; // JSON array stored as text
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface SyncConfig {
  id: number;
  org_id: number;
  provider: "s3" | "s3-compatible" | "dropbox" | "gdrive" | "onedrive";
  credentials_encrypted: string;
  enabled: number; // 1 = enabled, 0 = disabled
  schedule: string; // cron expression or "manual"
  remote_prefix: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: number;
  org_id: number;
  provider: string;
  status: "running" | "success" | "error";
  files_uploaded: number;
  files_deleted: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}
