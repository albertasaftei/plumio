import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { documentsRouter } from "./routes/documents.js";
import { authRouter } from "./routes/auth.js";

dotenv.config();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// Routes
app.route("/api/auth", authRouter);
app.route("/api/documents", documentsRouter);

// Initialize documents directory
const documentsPath = process.env.DOCUMENTS_PATH || "./documents";
await fs.mkdir(documentsPath, { recursive: true });

const port = parseInt(process.env.PORT || "3001");

console.log(`🚀 Pluma Backend starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
