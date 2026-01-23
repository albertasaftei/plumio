import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import fs from "fs";
import path from "path";
import "./config.js"; // Load configuration first
import { documentsRouter } from "./routes/documents.js";
import { authRouter } from "./routes/auth.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // In production, check against allowed origins
      if (process.env.NODE_ENV === "production") {
        // Build allowed origins from environment
        const frontendPort = process.env.FRONTEND_PORT || 3000;
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          `http://localhost:${frontendPort}`,
          `http://127.0.0.1:${frontendPort}`,
          `http://frontend:${frontendPort}`, // Docker internal network
        ].filter(Boolean);
        
        // Allow if origin matches or if no origin (same-origin requests)
        if (!origin || allowedOrigins.includes(origin)) {
          return origin || "*";
        }
        return null;
      }
      // In development, allow any origin
      return origin || "*";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// Routes
app.route("/api/auth", authRouter);
app.route("/api/documents", documentsRouter);

// Initialize documents directory
const documentsPath = process.env.DOCUMENTS_PATH || "./documents";
if (!fs.existsSync(documentsPath)) {
  fs.mkdirSync(documentsPath, { recursive: true });
}

const port = parseInt(process.env.PORT || "3001");

console.log(`🚀 Pluma Backend starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
