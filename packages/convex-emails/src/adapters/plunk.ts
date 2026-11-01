import {
  type Adapter,
  type AdapterOptions,
  apiUrl,
  bearer,
  type EmailEvent,
  isEmail,
  type Outcome,
  record,
  retryDelay,
} from "../client/types.js";
export function plunk(options: AdapterOptions): Adapter {
  const url = apiUrl(options.apiBaseUrl ?? "https://next-api.useplunk.com");
  return {
    name: "plunk",
    route: options.route,
    retryWindowMs: 23 * 60 * 60 * 1000,
    capabilities: { text: false },
    async send(message, key, attempt): Promise<Outcome> {
      const apiKey = options.apiKey ?? process.env.PLUNK_API_KEY;
      if (!apiKey) return { kind: "failed", error: "PLUNK_API_KEY is missing" };
      try {
        const response = await fetch(`${url}/v1/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            subject: message.subject,
            body: message.html,
            ...(message.replyTo ? { reply: message.replyTo } : {}),
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
        if (
          response.status === 409 ||
          response.status === 408 ||
          response.status >= 500
        )
          return { kind: "uncertain", error: `Plunk HTTP ${response.status}` };
        if (!response.ok)
          return { kind: "failed", error: `Plunk HTTP ${response.status}` };
        const body: unknown = await response.json();
        if (
          record(body) &&
          body.success === true &&
          record(body.data) &&
          Array.isArray(body.data.emails) &&
          body.data.emails.length === 1
        ) {
          const item: unknown = body.data.emails[0];
          if (record(item) && typeof item.email === "string" && item.email)
            return { kind: "accepted", providerId: item.email };
        }
        return { kind: "uncertain", error: "Unrecognized Plunk response" };
      } catch {
        return { kind: "uncertain", error: "Plunk network error or timeout" };
      }
    },
    async verifyWebhook(raw, headers) {
      bearer(
        headers,
        options.webhookSecret ?? process.env.PLUNK_WEBHOOK_SECRET,
      );
      return parsePlunkEvent(JSON.parse(raw));
    },
  };
}
export function parsePlunkEvent(input: unknown): EmailEvent[] {
  if (
    !record(input) ||
    typeof input.type !== "string" ||
    !record(input.contact) ||
    typeof input.contact.email !== "string" ||
    !isEmail(input.contact.email) ||
    !record(input.event)
  )
    throw new Error("Invalid Plunk event");
  const email = input.contact.email;
  const providerId = input.event.emailId;
  if (
    providerId !== undefined &&
    (typeof providerId !== "string" || !providerId.trim())
  )
    throw new Error("Invalid emailId");
  const correlation = typeof providerId === "string" ? { providerId } : {};
  switch (input.type) {
    case "email.delivery":
      if (!providerId) throw new Error("Missing emailId");
      return [{ type: "delivered", email, ...correlation }];
    case "email.bounce":
      if (input.event.bounceType === "Transient") return [];
      if (input.event.bounceType !== "Permanent")
        throw new Error("Unknown bounce type");
      return [{ type: "bounced", email, ...correlation }];
    case "email.complaint":
      return [{ type: "complained", email, ...correlation }];
    case "contact.unsubscribed":
      return [{ type: "unsubscribed", email }];
    case "contact.subscribed":
      return [{ type: "subscribed", email }];
    default:
      return [];
  }
}
