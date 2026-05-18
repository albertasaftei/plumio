import { createHmac } from "crypto";
import { db, webhookQueries, webhookDeliveryQueries } from "../db/index.js";

export type WebhookEvent =
  | "document.created"
  | "document.updated"
  | "document.deleted"
  | "document.renamed"
  | "document.archived"
  | "document.unarchived"
  | "document.restored"
  | "document.tagged"
  | "document.untagged"
  | "folder.created"
  | "folder.deleted"
  | "tag.created"
  | "tag.updated"
  | "tag.deleted"
  | "ping";

export interface WebhookPayload {
  event: WebhookEvent;
  org_id: number;
  timestamp: string;
  data: Record<string, unknown>;
}

function signPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Fire-and-forget: delivers a webhook event to all active subscribers for the
 * given org that have subscribed to the event. Errors are logged and recorded
 * in webhook_deliveries but are never thrown to the caller.
 */
export function deliverWebhook(
  orgId: number,
  event: WebhookEvent,
  data: Record<string, unknown>,
): void {
  // Intentionally not awaited — caller never blocks on delivery
  void _deliver(orgId, event, data);
}

async function _deliver(
  orgId: number,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const activeWebhooks = webhookQueries.listActiveForOrgAndEvent.all(orgId);

    const subscribers = activeWebhooks.filter((wh) => {
      try {
        const events: string[] = JSON.parse(wh.events);
        return events.includes(event) || events.includes("*");
      } catch {
        return false;
      }
    });

    if (subscribers.length === 0) return;

    const payload: WebhookPayload = {
      event,
      org_id: orgId,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      subscribers.map((wh) =>
        _sendToWebhook(wh.id, wh.url, wh.secret, event, body),
      ),
    );
  } catch (err) {
    console.error("[webhooks] Error during delivery dispatch:", err);
  }
}

async function _sendToWebhook(
  webhookId: number,
  url: string,
  secret: string,
  event: WebhookEvent,
  body: string,
): Promise<void> {
  // Insert a delivery record before attempting
  const insertResult = webhookDeliveryQueries.insert.run(
    webhookId,
    event,
    body,
  );
  const deliveryId = insertResult.lastInsertRowid as number;

  let status: "success" | "failed" = "failed";
  let responseStatus: number | null = null;
  let responseBody: string | null = null;

  try {
    const signature = signPayload(secret, body);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Plumio-Event": event,
          "X-Plumio-Signature": signature,
          "User-Agent": "Plumio-Webhooks/1.0",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 1000); // cap stored response
      status = res.ok ? "success" : "failed";
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      responseBody =
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    }
  } catch (err) {
    responseBody = err instanceof Error ? err.message : String(err);
  }

  try {
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
    console.error("[webhooks] Failed to record delivery result:", dbErr);
  }
}
