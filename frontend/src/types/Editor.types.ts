export interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  documentPath?: string;
  onInternalNavigate?: (path: string) => void;
}
