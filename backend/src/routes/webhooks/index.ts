import { Hono } from "hono";
import { authMiddleware } from "../../middlewares/auth.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import {
  webhookQueries,
  webhookDeliveryQueries,
  memberQueries,
} from "../../db/index.js";
import { deliverWebhook } from "../../utils/webhooks.js";
import * as z from "zod";
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
  deliveriesQuerySchema,
} from "./helpers/schemas.js";

type Variables = {
  user: UserJWTPayload;
};

const webhooksRouter = new Hono<{ Variables: Variables }>();

webhooksRouter.use("*", authMiddleware);

// List webhooks for the current org
webhooksRouter.get("/", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const webhooks = webhookQueries.listByOrg.all(user.currentOrgId);
  // Strip secrets from list response
  const safe = webhooks.map(({ secret: _secret, ...wh }) => ({
    ...wh,
    events: JSON.parse(wh.events) as string[],
  }));
  return c.json({ webhooks: safe });
});

// Create a webhook
webhooksRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const body = await c.req.json();
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  const { name, url, secret, events } = parsed.data;

  const result = webhookQueries.create.run(
    user.currentOrgId,
    name,
    url,
    secret,
    JSON.stringify(events),
    user.userId,
  );

  const webhook = webhookQueries.findById.get(result.lastInsertRowid as number);
  if (!webhook) {
    return c.json({ error: "Failed to create webhook" }, 500);
  }

  const { secret: _secret, ...safe } = webhook;
  return c.json(
    { webhook: { ...safe, events: JSON.parse(webhook.events) as string[] } },
    201,
  );
});

// Update a webhook
webhooksRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const paramParsed = webhookIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!paramParsed.success) {
    return c.json({ error: "Invalid webhook ID" }, 400);
  }

  const webhook = webhookQueries.findById.get(paramParsed.data.id);
  if (!webhook || webhook.org_id !== user.currentOrgId) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  const name = parsed.data.name ?? webhook.name;
  const url = parsed.data.url ?? webhook.url;
  const secret = parsed.data.secret ?? webhook.secret;
  const events =
    parsed.data.events !== undefined
      ? JSON.stringify(parsed.data.events)
      : webhook.events;
  const active =
    parsed.data.active !== undefined
      ? parsed.data.active
        ? 1
        : 0
      : webhook.active;

  webhookQueries.update.run(name, url, secret, events, active, webhook.id);

  const updated = webhookQueries.findById.get(webhook.id)!;
  const { secret: _secret, ...safe } = updated;
  return c.json({
    webhook: { ...safe, events: JSON.parse(updated.events) as string[] },
  });
});

// Delete a webhook
webhooksRouter.delete("/:id", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const paramParsed = webhookIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!paramParsed.success) {
    return c.json({ error: "Invalid webhook ID" }, 400);
  }

  const webhook = webhookQueries.findById.get(paramParsed.data.id);
  if (!webhook || webhook.org_id !== user.currentOrgId) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  webhookQueries.delete.run(webhook.id);
  return c.json({ message: "Webhook deleted" });
});

// List deliveries for a webhook (paginated)
webhooksRouter.get("/:id/deliveries", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const paramParsed = webhookIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!paramParsed.success) {
    return c.json({ error: "Invalid webhook ID" }, 400);
  }

  const webhook = webhookQueries.findById.get(paramParsed.data.id);
  if (!webhook || webhook.org_id !== user.currentOrgId) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  const queryParsed = deliveriesQuerySchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });
  const page = queryParsed.success ? queryParsed.data.page : 1;
  const limit = queryParsed.success ? queryParsed.data.limit : 20;
  const offset = (page - 1) * limit;

  const deliveries = webhookDeliveryQueries.listByWebhook.all(
    webhook.id,
    limit,
    offset,
  );

  return c.json({ deliveries, page, limit });
});

// Send a test ping event
webhooksRouter.post("/:id/test", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const paramParsed = webhookIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!paramParsed.success) {
    return c.json({ error: "Invalid webhook ID" }, 400);
  }

  const webhook = webhookQueries.findById.get(paramParsed.data.id);
  if (!webhook || webhook.org_id !== user.currentOrgId) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  // Deliver a ping directly to this specific webhook, bypassing event subscription filter
  void _deliverPingToWebhook(
    webhook.id,
    webhook.url,
    webhook.secret,
    user.currentOrgId,
  );

  return c.json({ message: "Test ping sent" });
});

async function _deliverPingToWebhook(
  webhookId: number,
  url: string,
  secret: string,
  orgId: number,
): Promise<void> {
  const { createHmac } = await import("crypto");
  const payload = JSON.stringify({
    event: "ping",
    org_id: orgId,
    timestamp: new Date().toISOString(),
    data: { message: "This is a test ping from Plumio" },
  });

  const signature =
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");

  const insertResult = webhookDeliveryQueries.insert.run(
    webhookId,
    "ping",
    payload,
  );
  const deliveryId = insertResult.lastInsertRowid as number;

  let status: "success" | "failed" = "failed";
  let responseStatus: number | null = null;
  let responseBody: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Plumio-Event": "ping",
          "X-Plumio-Signature": signature,
          "User-Agent": "Plumio-Webhooks/1.0",
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 1000);
      status = res.ok ? "success" : "failed";
    } catch (err) {
      responseBody = err instanceof Error ? err.message : String(err);
    }
  } catch (err) {
    responseBody = err instanceof Error ? err.message : String(err);
  }

  try {
    const { db } = await import("../../db/index.js");
    db.prepare(
      "UPDATE webhook_deliveries SET status = ?, response_status = ?, response_body = ?, attempts = attempts + 1, delivered_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?",
    ).run(
      status,
      responseStatus,
      responseBody,
      status === "success" ? 1 : 0,
      deliveryId,
    );
  } catch (dbErr) {
    console.error("[webhooks] Failed to record ping delivery result:", dbErr);
  }
}

export { webhooksRouter };
