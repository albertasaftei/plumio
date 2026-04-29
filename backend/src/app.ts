import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { readFileSync } from "fs";
import "./config.js";
import "./db/index.js";
import { settingsQueries } from "./db/index.js";
import { documentsRouter } from "./routes/documents/index.js";
import { attachmentsRouter } from "./routes/attachments/index.js";
import { authRouter } from "./routes/auth/index.js";
import { adminRouter } from "./routes/admin/index.js";
import { organizationsRouter } from "./routes/organizations/index.js";
import { tagsRouter } from "./routes/tags/index.js";
import { joinRequestsRouter } from "./routes/join-requests/index.js";
import { notificationsRouter } from "./routes/notifications/index.js";
import { UserJWTPayload } from "./middlewares/auth.types.js";
import path from "path";
import { fileURLToPath } from "url";

type Variables = {
  user: UserJWTPayload;
};

export const app = new Hono<{ Variables: Variables }>();

// Middleware
if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}
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
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) =>
            o.trim().replace(/\/$/, ""),
          )
        : [];

      if (allowedOrigins.length > 0) {
        return allowedOrigins.includes(origin.replace(/\/$/, ""))
          ? origin
          : null;
      }

      // If no ALLOWED_ORIGINS set, allow all in development
      if (process.env.NODE_ENV !== "production") {
        return origin || "*";
      }

      // In production without ALLOWED_ORIGINS, allow all (self-hosted friendly)
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
    readFileSync(path.join(__dirname, "../package.json"), "utf-8"),
  );

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    appVersion: packageJson.version,
  });
});

// Version check — fetches latest GitHub release server-side and caches result.
let versionCache: {
  data: {
    latestVersion: string | null;
    releaseUrl: string | null;
  };
  cachedAt: number;
} | null = null;

app.get("/api/version/check", async (c) => {
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  if (versionCache && Date.now() - versionCache.cachedAt < TWELVE_HOURS) {
    return c.json(versionCache.data);
  }

  try {
    const response = await fetch(
      "https://api.github.com/repos/albertasaftei/plumio/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "plumio-instance/1.0",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const release = (await response.json()) as {
      tag_name: string;
      html_url: string;
      draft: boolean;
      prerelease: boolean;
    };

    if (release.draft || release.prerelease) {
      throw new Error("Latest release is a draft or prerelease");
    }

    const data = {
      latestVersion: release.tag_name,
      releaseUrl: release.html_url,
    };

    versionCache = { data, cachedAt: Date.now() };
    return c.json(data);
  } catch {
    return c.json({ latestVersion: null, releaseUrl: null });
  }
});

// Public config endpoint (no auth required — only exposes non-sensitive flags)
app.get("/api/config", (c) => {
  const rows = settingsQueries.getAll.all();
  const config: Record<string, boolean | string> = {};
  for (const row of rows) {
    if (row.value === "true" || row.value === "false") {
      config[row.key] = row.value === "true";
    } else {
      config[row.key] = row.value;
    }
  }
  return c.json(config);
});

// Routes
app.route("/api/auth", authRouter);
app.route("/api/auth/admin", adminRouter);
app.route("/api/organizations", organizationsRouter);
app.route("/api/documents", documentsRouter);
app.route("/api/attachments", attachmentsRouter);
app.route("/api/tags", tagsRouter);
app.route("/api/join-requests", joinRequestsRouter);
app.route("/api/notifications", notificationsRouter);
