import { Webhook } from "svix";
import { afterEach, expect, it, vi } from "vitest";
import { apiUrl, validateMessage } from "../client/types.js";
import { parsePlunkEvent, plunk } from "./plunk.js";
import { parseResendEvent, resend } from "./resend.js";

const message = {
  from: "hello@example.com",
  to: "reader@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
};
const options = { route: "primary", apiKey: "test-key" };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("maps Plunk fields and never changes subscription", async () => {
  const f = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ success: true, data: { emails: [{ email: "p1" }] } }),
    );
  vi.stubGlobal("fetch", f);
  expect(
    await plunk(options).send(
      { ...message, replyTo: "reply@example.com" },
      "stable",
      1,
    ),
  ).toEqual({ kind: "accepted", providerId: "p1" });
  expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({
    ...message,
    html: undefined,
    body: message.html,
    reply: "reply@example.com",
  });
  expect(f.mock.calls[0][1]?.redirect).toBe("error");
});
it("maps Resend fields and preserves the key", async () => {
  const f = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ id: "r1" }));
  vi.stubGlobal("fetch", f);
  expect(
    await resend(options).send(
      { ...message, text: "Hello", replyTo: "reply@example.com" },
      "stable",
      1,
    ),
  ).toEqual({ kind: "accepted", providerId: "r1" });
  expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({
    ...message,
    to: [message.to],
    text: "Hello",
    reply_to: "reply@example.com",
  });
  expect(new Headers(f.mock.calls[0][1]?.headers).get("idempotency-key")).toBe(
    "stable",
  );
});
it.each([401, 402, 422])("classifies definitive HTTP %i", async (status) => {
  vi.stubGlobal("fetch", async () => new Response(null, { status }));
  for (const adapter of [plunk(options), resend(options)])
    expect((await adapter.send(message, "key", 1)).kind).toBe("failed");
});
it.each([408, 500, 503])(
  "keeps provider-specific behavior for HTTP %i",
  async (status) => {
    vi.stubGlobal("fetch", async () => new Response(null, { status }));
    expect((await plunk(options).send(message, "key", 1)).kind).toBe(
      "uncertain",
    );
    expect(await resend(options).send(message, "key", 1)).toMatchObject({
      kind: "retry",
      ambiguous: true,
    });
  },
);
it("does not resend a Plunk duplicate; retries a Resend request still in progress", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ name: "concurrent_idempotent_requests" }, { status: 409 }),
  );
  expect((await plunk(options).send(message, "key", 1)).kind).toBe("uncertain");
  expect(await resend(options).send(message, "key", 1)).toMatchObject({
    kind: "retry",
    ambiguous: true,
  });
  vi.stubGlobal("fetch", async () =>
    Response.json({ name: "invalid_idempotent_request" }, { status: 409 }),
  );
  expect((await resend(options).send(message, "key", 1)).kind).toBe(
    "uncertain",
  );
});
it("respects long Retry-After values without shortening them", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(null, { status: 429, headers: { "retry-after": "7200" } }),
  );
  for (const adapter of [plunk(options), resend(options)])
    expect(await adapter.send(message, "key", 1)).toEqual({
      kind: "retry",
      delayMs: 7200000,
      ambiguous: false,
    });
});
it("distinguishes network ambiguity", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("network");
  });
  expect((await plunk(options).send(message, "key", 1)).kind).toBe("uncertain");
  expect(await resend(options).send(message, "key", 1)).toMatchObject({
    kind: "retry",
    ambiguous: true,
  });
});
it("does not accept malformed success payloads", async () => {
  vi.stubGlobal("fetch", async () => Response.json({}));
  for (const adapter of [plunk(options), resend(options)])
    expect((await adapter.send(message, "key", 1)).kind).toBe("uncertain");
});
it("verifies real Svix signatures and rejects tampering and old timestamps", async () => {
  const secret = `whsec_${btoa("01234567890123456789012345678901")}`;
  const body = JSON.stringify({
    type: "email.delivered",
    data: { email_id: "r1", to: [message.to] },
  });
  const time = new Date();
  const signature = await new Webhook(secret).sign("evt1", time, body);
  const headers = new Headers({
    "svix-id": "evt1",
    "svix-timestamp": String(Math.floor(time.getTime() / 1000)),
    "svix-signature": signature,
  });
  const adapter = resend({ ...options, webhookSecret: secret });
  expect(await adapter.verifyWebhook(body, headers)).toEqual([
    { type: "delivered", email: message.to, providerId: "r1" },
  ]);
  await expect(adapter.verifyWebhook(`${body} `, headers)).rejects.toThrow(
    "signature",
  );
  const old = new Date(Date.now() - 3600000);
  headers.set("svix-timestamp", String(Math.floor(old.getTime() / 1000)));
  headers.set(
    "svix-signature",
    await new Webhook(secret).sign("evt1", old, body),
  );
  await expect(adapter.verifyWebhook(body, headers)).rejects.toThrow(
    "signature",
  );
});
it("authenticates Plunk custom workflow envelopes", async () => {
  const body = JSON.stringify({
    type: "contact.unsubscribed",
    contact: { email: message.to },
    event: {},
  });
  const adapter = plunk({ ...options, webhookSecret: "secret" });
  expect(
    await adapter.verifyWebhook(
      body,
      new Headers({ authorization: "Bearer secret" }),
    ),
  ).toEqual([{ type: "unsubscribed", email: message.to }]);
  await expect(adapter.verifyWebhook(body, new Headers())).rejects.toThrow(
    "authentication",
  );
});
it("normalizes complaints and rejects bad correlation data", () => {
  expect(
    parseResendEvent({
      type: "email.complained",
      data: { email_id: "r1", to: [message.to] },
    })[0].type,
  ).toBe("complained");
  expect(() =>
    parseResendEvent({ type: "email.delivered", data: {} }),
  ).toThrow();
  expect(
    parsePlunkEvent({
      type: "email.bounce",
      contact: { email: message.to },
      event: { bounceType: "Transient" },
    }),
  ).toEqual([]);
  expect(() =>
    parsePlunkEvent({
      type: "email.bounce",
      contact: { email: message.to },
      event: { bounceType: "Unknown" },
    }),
  ).toThrow();
});
it("validates addresses, headers, byte limits, and HTTPS", () => {
  expect(() => validateMessage({ ...message, to: "bad\naddress" })).toThrow();
  expect(() =>
    validateMessage({ ...message, html: "😀".repeat(125001) }),
  ).toThrow();
  expect(() =>
    validateMessage({ ...message, headers: { "X:bad": "value" } }),
  ).toThrow();
  expect(() => apiUrl("http://example.com")).toThrow();
  expect(() => apiUrl("https://user:secret@example.com")).toThrow();
});
