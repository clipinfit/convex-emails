import { Webhook } from "svix";
import {
  type Adapter,
  type AdapterOptions,
  apiUrl,
  type EmailEvent,
  isEmail,
  type Outcome,
  record,
  retryDelay,
  WebhookError,
} from "../client/types.js";
export function resend(options: AdapterOptions): Adapter {
  const url = apiUrl(options.apiBaseUrl ?? "https://api.resend.com");
  return {
    name: "resend",
    route: options.route,
    retryWindowMs: 23 * 60 * 60 * 1000,
    capabilities: { text: true },
    async send(message, key, attempt): Promise<Outcome> {
      const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
      if (!apiKey)
        return { kind: "failed", error: "RESEND_API_KEY is missing" };
      try {
        const response = await fetch(`${url}/emails`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            ...(message.text !== undefined ? { text: message.text } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
            ...(message.headers ? { headers: message.headers } : {}),
          }),
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        });
        if (response.status === 429)
          return {
            kind: "retry",
            delayMs: retryDelay(response, attempt),
            ambiguous: false,
          };
        if (response.status >= 500 || response.status === 408)
          return {
            kind: "retry",
            delayMs: retryDelay(response, attempt),
            ambiguous: true,
          };
        if (response.status === 409) {
          const error: unknown = await response.json();
          if (record(error) && error.name === "concurrent_idempotent_requests")
            return {
              kind: "retry",
              delayMs: retryDelay(response, attempt),
              ambiguous: true,
            };
          return { kind: "uncertain", error: "Resend idempotency conflict" };
        }
        if (!response.ok)
          return { kind: "failed", error: `Resend HTTP ${response.status}` };
        const body: unknown = await response.json();
        if (record(body) && typeof body.id === "string" && body.id)
          return { kind: "accepted", providerId: body.id };
        return { kind: "uncertain", error: "Unrecognized Resend response" };
      } catch {
        return {
          kind: "retry",
          delayMs: Math.min(60000, 1000 * 2 ** Math.min(attempt, 6)),
          ambiguous: true,
        };
      }
    },
    async verifyWebhook(raw, headers) {
      const secret = options.webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) throw new WebhookError(503, "Webhook is not configured");
      try {
        await new Webhook(secret).verify(raw, {
          "svix-id": headers.get("svix-id") ?? "",
          "svix-timestamp": headers.get("svix-timestamp") ?? "",
          "svix-signature": headers.get("svix-signature") ?? "",
        });
      } catch {
        throw new WebhookError(401, "Invalid webhook signature");
      }
      const payload: unknown = JSON.parse(raw);
      return parseResendEvent(payload);
    },
  };
}
export function parseResendEvent(input: unknown): EmailEvent[] {
  if (!record(input) || typeof input.type !== "string")
    throw new Error("Invalid Resend event");
  let type: EmailEvent["type"];
  switch (input.type) {
    case "email.delivered":
      type = "delivered";
      break;
    case "email.bounced":
      type = "bounced";
      break;
    case "email.complained":
      type = "complained";
      break;
    default:
      return [];
  }
  if (
    !record(input.data) ||
    typeof input.data.email_id !== "string" ||
    !input.data.email_id ||
    !Array.isArray(input.data.to) ||
    !input.data.to.length
  )
    throw new Error("Invalid Resend event data");
  const providerId = input.data.email_id;
  return input.data.to.map((email: unknown) => {
    if (typeof email !== "string" || !isEmail(email))
      throw new Error("Invalid recipient");
    return { type, email, providerId };
  });
}
