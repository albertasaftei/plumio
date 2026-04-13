export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_admin: number; // 1 = admin, 0 = regular user
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
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: string;
  joined_at: string;
  username: string;
  email: string;
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

export interface TagWithCount extends Tag {
  document_count: number;
}
