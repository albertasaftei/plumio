import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import fs, { readFileSync } from "fs";
import "./config.js";
import "./db/index.js";
import { documentsRouter } from "./routes/documents.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { organizationsRouter } from "./routes/organizations.js";
import { UserJWTPayload } from "./middlewares/auth.types.js";
import path from "path";
import { fileURLToPath } from "url";

type Variables = {
  user: UserJWTPayload;
};

const app = new Hono<{ Variables: Variables }>();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow same-origin requests (no origin header)
      if (!origin) {
        return "*";
      }

      // Check ALLOWED_ORIGINS env variable
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : [];

      if (allowedOrigins.length > 0) {
        return allowedOrigins.includes(origin) ? origin : null;
      }

      // If no ALLOWED_ORIGINS set, allow all in development
      if (process.env.NODE_ENV !== "production") {
        return origin || "*";
      }

      // In production without ALLOWED_ORIGINS, allow all (self-hosted friendly)
      // For security, set ALLOWED_ORIGINS env variable with your frontend URLs:
      // ALLOWED_ORIGINS=http://192.168.1.100:3000
      return origin;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Health check
app.get("/api/health", (c) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, "../../package.json"), "utf-8"),
  );

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    appVersion: packageJson.version,
  });
});

// Routes
app.route("/api/auth", authRouter);
app.route("/api/auth/admin", adminRouter);
app.route("/api/organizations", organizationsRouter);
app.route("/api/documents", documentsRouter);

// Initialize documents directory
const documentsPath = process.env.DOCUMENTS_PATH || "./documents";
if (!fs.existsSync(documentsPath)) {
  fs.mkdirSync(documentsPath, { recursive: true });
}

const port = parseInt(process.env.BACKEND_INTERNAL_PORT || "3001");

console.log(`🚀 Plumio Backend starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
