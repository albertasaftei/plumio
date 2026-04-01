// Escape HTML special characters before storing in FTS to prevent XSS via snippet()
export function escapeHtmlForFts(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
