export interface Tag {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface DocumentTag {
  id: number;
  name: string;
  color: string | null;
}
