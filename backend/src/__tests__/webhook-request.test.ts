import { describe, expect, it, vi } from "vitest";
import {
  createPublicAddressLookup,
  isAllowedWebhookUrl,
  isPublicWebhookAddress,
} from "../utils/webhook-request.js";

describe("webhook outbound destination policy", () => {
  it.each([
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.20.1.2",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "203.0.113.1",
    "224.0.0.1",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "3fff::1",
    "fc00::1",
    "fe80::1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicWebhookAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPublicWebhookAddress(address)).toBe(true);
    },
  );

  it.each([
    "ftp://example.com/hook",
    "http://127.0.0.1/hook",
    "http://[::1]/hook",
    "http://user:pass@example.com/hook",
  ])("rejects unsafe webhook URL %s", (url) => {
    expect(isAllowedWebhookUrl(url)).toBe(false);
  });

  it("pins the selected DNS answer to a public address", async () => {
    const resolve = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 as const },
    ]);
    const lookup = createPublicAddressLookup(resolve);
    const result = await new Promise<{ address: string; family?: number }>(
      (resolveResult, reject) => {
        lookup("webhook.example", {}, (error, address, family) => {
          if (error) reject(error);
          else if (typeof address !== "string") {
            reject(new Error("Expected a single address"));
          } else resolveResult({ address, family });
        });
      },
    );

    expect(result).toEqual({ address: "93.184.216.34", family: 4 });
    expect(resolve).toHaveBeenCalledWith("webhook.example");
  });

  it("rejects DNS answers containing any non-public address", async () => {
    const lookup = createPublicAddressLookup(async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "10.0.0.1", family: 4 as const },
    ]);

    await expect(
      new Promise((resolve, reject) => {
        lookup("webhook.example", {}, (error, address) => {
          if (error) reject(error);
          else resolve(address);
        });
      }),
    ).rejects.toMatchObject({ code: "EACCES" });
  });
});