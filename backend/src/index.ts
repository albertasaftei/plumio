import { serve } from "@hono/node-server";
import fs from "fs";
import { app } from "./app.js";

// Initialize documents directory
const documentsPath = process.env.DOCUMENTS_PATH || "./documents";
if (!fs.existsSync(documentsPath)) {
  fs.mkdirSync(documentsPath, { recursive: true });
}

const port = parseInt(process.env.BACKEND_INTERNAL_PORT || "3001");

console.log(`🚀 Plumio Backend starting on port ${port}`);
console.log(`📂 Documents directory: ${documentsPath}`);

serve({
  fetch: app.fetch,
  port,
});
