import { lookup, type LookupAddress } from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";

const NON_PUBLIC_IPV4_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
].map((range) => ipaddr.parseCIDR(range));

const GLOBAL_IPV6_RANGE = ipaddr.parseCIDR("2000::/3");
const NON_PUBLIC_IPV6_RANGES = [
  "2001:db8::/32",
  "3fff::/20",
].map((range) => ipaddr.parseCIDR(range));

type AddressResolver = (hostname: string) => Promise<LookupAddress[]>;

const resolveAddresses: AddressResolver = (hostname) =>
  new Promise((resolve, reject) => {
    lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

function normalizedHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

export function isPublicWebhookAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);

    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }

    if (parsed.kind() === "ipv4") {
      return (
        parsed.range() === "unicast" &&
        !NON_PUBLIC_IPV4_RANGES.some((range) => parsed.match(range))
      );
    }

    return (
      parsed.range() === "unicast" &&
      parsed.match(GLOBAL_IPV6_RANGE) &&
      !NON_PUBLIC_IPV6_RANGES.some((range) => parsed.match(range))
    );
  } catch {
    return false;
  }
}

export function isAllowedWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return false;
    }

    const hostname = normalizedHostname(url.hostname);
    return isIP(hostname) === 0 || isPublicWebhookAddress(hostname);
  } catch {
    return false;
  }
}

function lookupError(message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = "EACCES";
  return error;
}

export function createPublicAddressLookup(
  resolve: AddressResolver = resolveAddresses,
): LookupFunction {
  return (hostname, options, callback) => {
    void resolve(hostname)
      .then((addresses) => {
        if (
          addresses.length === 0 ||
          addresses.some(({ address }) => !isPublicWebhookAddress(address))
        ) {
          throw lookupError("Webhook destination is not publicly routable");
        }

        const matchingFamily = addresses.filter(
          ({ family }) =>
            !options.family || options.family === 0 || family === options.family,
        );
        if (matchingFamily.length === 0) {
          throw lookupError("No public address matches the requested family");
        }

        if (options.all) {
          callback(null, matchingFamily);
        } else {
          const selected = matchingFamily[0];
          callback(null, selected.address, selected.family);
        }
      })
      .catch((error: unknown) => {
        callback(
          error instanceof Error
            ? (error as NodeJS.ErrnoException)
            : lookupError(String(error)),
          "",
        );
      });
  };
}

export interface WebhookRequestResult {
  status: number | null;
  body: string;
  ok: boolean;
}

export async function sendWebhookRequest(
  value: string,
  headers: Record<string, string>,
  body: string,
): Promise<WebhookRequestResult> {
  if (!isAllowedWebhookUrl(value)) {
    throw new Error("Webhook URL must use HTTP(S) and a public destination");
  }

  const url = new URL(value);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const request = url.protocol === "https:" ? https.request : http.request;
    return await new Promise((resolve, reject) => {
      const outgoing = request(
        url,
        {
          method: "POST",
          headers,
          signal: controller.signal,
          lookup: createPublicAddressLookup(),
        },
        (response) => {
          let responseBody = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            if (responseBody.length < 1000) {
              responseBody += chunk.slice(0, 1000 - responseBody.length);
            }
          });
          response.on("end", () => {
            const status = response.statusCode ?? null;
            resolve({
              status,
              body: responseBody,
              ok: status !== null && status >= 200 && status < 300,
            });
          });
        },
      );

      outgoing.on("error", reject);
      outgoing.end(body);
    });
  } finally {
    clearTimeout(timeoutId);
  }
}