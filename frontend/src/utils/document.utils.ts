/**
 * Gets a clean display name from a document name or path, removing timestamps and extensions
 * Handles archived (.archived-{timestamp}.md) and deleted (.deleted-{timestamp}.md) files
 * @param filePath - The document name or full path
 * @returns The cleaned display name without .md extension
 */
export function getDisplayName(filePath: string): string {
  const fileName = filePath.split("/").pop() || "";
  // Remove .archived-{timestamp}.md or .deleted-{timestamp}.md suffix, then remove .md extension
  return fileName
    .replace(/\.(archived|deleted)-\d+\.md$/, "")
    .replace(/\.md$/, "");
}
