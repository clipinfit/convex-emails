export type Message = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};
export type Outcome =
  | { kind: "accepted"; providerId: string }
  | { kind: "retry"; delayMs: number; ambiguous: boolean }
  | { kind: "failed"; error: string }
  | { kind: "uncertain"; error: string };
export type EmailEvent = {
  type: "delivered" | "bounced" | "complained" | "unsubscribed" | "subscribed";
  email: string;
  providerId?: string;
};
export type Adapter = {
  readonly name: string;
  readonly route: string;
  readonly retryWindowMs: number;
  readonly capabilities: { readonly text: boolean };
  send(message: Message, key: string, attempt: number): Promise<Outcome>;
  verifyWebhook(raw: string, headers: Headers): Promise<EmailEvent[]>;
};
export type AdapterOptions = {
  route: string;
  apiKey?: string;
  webhookSecret?: string;
  apiBaseUrl?: string;
};
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isEmail(value: string) {
  return value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}
export function validateMessage(message: Message) {
  for (const value of [message.from, message.to, message.replyTo].filter(
    (v) => v !== undefined,
  ))
    if (!isEmail(value))
      throw new Error("Use a plain email address for from, to and replyTo");
  if (
    !message.subject.trim() ||
    /[\r\n]/.test(message.subject) ||
    message.subject.length > 998
  )
    throw new Error("Invalid subject");
  if (
    !message.html.trim() ||
    new TextEncoder().encode(message.html).byteLength > 500000
  )
    throw new Error("Provide HTML within the 500 KB component limit");
  if (
    message.text !== undefined &&
    new TextEncoder().encode(message.text).byteLength > 500000
  )
    throw new Error("Text exceeds 500 KB");
  for (const [key, value] of Object.entries(message.headers ?? {}))
    if (
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key) ||
      /[\r\n]/.test(key + value) ||
      value.length > 998 ||
      ["authorization", "idempotency-key"].includes(key.toLowerCase())
    )
      throw new Error("Invalid or reserved email header");
}

export function apiUrl(input: string) {
  const u = new URL(input);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw new Error(
      "Use an HTTPS API URL without credentials, query, or fragment",
    );
  return u.toString().replace(/\/$/, "");
}
export function retryDelay(response: Response, attempt: number) {
  const value = response.headers.get("retry-after");
  const seconds = value ? Number(value) : NaN;
  const parsed = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value ?? "") - Date.now();
  return Number.isFinite(parsed)
    ? Math.max(1000, parsed)
    : Math.min(60000, 1000 * 2 ** Math.min(attempt, 6));
}
export class WebhookError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function bearer(headers: Headers, secret: string | undefined) {
  if (!secret) throw new WebhookError(503, "Webhook is not configured");
  const a = new TextEncoder().encode(headers.get("authorization") ?? "");
  const b = new TextEncoder().encode(`Bearer ${secret}`);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  if (diff) throw new WebhookError(401, "Invalid webhook authentication");
}
