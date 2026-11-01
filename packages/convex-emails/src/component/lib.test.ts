/// <reference types="vite/client" />

import { defineSchema } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  components,
  internal,
} from "../../../example-backend/convex/_generated/api.js";
import { plunk as plunkAdapter } from "../adapters/plunk.js";
import { Emails } from "../client/index.js";
import { register } from "../test.js";

const modules = import.meta.glob("../../../example-backend/convex/**/*.ts");
const message = {
  from: "hello@example.com",
  to: "reader@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
};
function setup() {
  vi.useFakeTimers();
  const t = convexTest(defineSchema({}), modules);
  register(t);
  return t;
}
async function enqueue(
  t: ReturnType<typeof setup>,
  key = "one",
  testMode = true,
  scheduledAt?: number,
) {
  return t.mutation(components.emails.lib.enqueue, {
    key,
    message,
    worker: await t.run(async () => {
      const { createFunctionHandle } = await import("convex/server");
      return createFunctionHandle(internal.emails.deliver);
    }),
    testMode,
    scheduledAt: scheduledAt ?? Date.now(),
    intervalMs: 1000,
    route: "plunk-primary",
    provider: "plunk",
    maxAttempts: 5,
    retryWindowMs: 23 * 3600000,
  });
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("durable component", () => {
  it("queues once per business key and rejects changed content", async () => {
    const t = setup();
    const id = await enqueue(t);
    expect(await enqueue(t)).toBe(id);
    const row = await t.query(components.emails.lib.get, { id });
    expect(row?.attempts).toBe(0);
    await expect(
      t.mutation(components.emails.lib.enqueue, {
        key: "one",
        message: { ...message, subject: "Changed" },
        worker: row?.worker ?? "",
        testMode: true,
        scheduledAt: Date.now(),
        intervalMs: 1000,
        route: "plunk-primary",
        provider: "plunk",
        maxAttempts: 5,
        retryWindowMs: 23 * 3600000,
      }),
    ).rejects.toThrow("conflicts");
  });
  it("runs the exported host worker in test mode without credentials or network", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const t = setup();
    const id = await t.mutation(internal.emails.enqueue, {
      key: "host",
      to: message.to,
    });
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "test",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("cancels queued work", async () => {
    const t = setup();
    const id = await enqueue(t);
    expect(await t.mutation(components.emails.lib.cancel, { id })).toBe(true);
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).toBeNull();
  });
  it("reserves paced slots and waits until the due time", async () => {
    const t = setup();
    await enqueue(t, "a");
    const id = await enqueue(t, "b");
    expect(
      (await t.query(components.emails.lib.get, { id }))?.scheduledAt,
    ).toBeGreaterThan(Date.now());
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).toBeNull();
  });
  it("rejects a second claim for a processing record", async () => {
    const t = setup();
    const id = await enqueue(t);
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).not.toBeNull();
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).toBeNull();
  });
  it("suppresses blocked transactional recipients", async () => {
    const t = setup();
    await t.mutation(components.emails.lib.restrict, {
      email: message.to,
      blocked: true,
      marketingUnsubscribed: true,
    });
    const id = await enqueue(t);
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).toBeNull();
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "suppressed",
    );
  });
  it("does not treat marketing-only unsubscribe as a transactional block", async () => {
    const t = setup();
    await t.mutation(components.emails.lib.restrict, {
      email: message.to,
      blocked: false,
      marketingUnsubscribed: true,
    });
    const id = await enqueue(t);
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).not.toBeNull();
  });
  it("retries 429 with the same row and rejects stale completion tokens", async () => {
    const t = setup();
    const id = await enqueue(t);
    const row = await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    });
    expect(row).not.toBeNull();
    await t.mutation(components.emails.lib.finish, {
      id,
      token: row?.token ?? 0,
      outcome: { kind: "retry", ambiguous: false, delayMs: 30000 },
    });
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "queued",
    );
    await t.mutation(components.emails.lib.finish, {
      id,
      token: 999,
      outcome: { kind: "accepted", providerId: "wrong" },
    });
    expect(
      (await t.query(components.emails.lib.get, { id }))?.providerId,
    ).toBeUndefined();
  });
  it("records delivery feedback and never resubscribes on a subscribe event", async () => {
    const t = setup();
    const id = await enqueue(t);
    await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    });
    await t.mutation(components.emails.lib.finish, {
      id,
      token: 1,
      outcome: { kind: "accepted", providerId: "p1" },
    });
    const event = {
      route: "plunk-primary",
      key: "event-1",
      type: "delivered" as const,
      email: message.to,
      providerId: "p1",
    };
    expect(await t.mutation(components.emails.lib.event, event)).toBe(true);
    expect(await t.mutation(components.emails.lib.event, event)).toBe(false);
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "delivered",
    );
    await t.mutation(components.emails.lib.event, {
      route: "plunk-primary",
      key: "denial",
      type: "complained" as const,
      email: message.to,
    });
    await t.mutation(components.emails.lib.event, {
      route: "plunk-primary",
      key: "subscribe",
      type: "subscribed" as const,
      email: message.to,
    });
    expect(
      (await t.query(components.emails.lib.restriction, { email: message.to }))
        ?.blocked,
    ).toBe(true);
  });
  it("expires a crashed worker into uncertain rather than resending", async () => {
    vi.useFakeTimers();
    const t = setup();
    const id = await enqueue(t);
    await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "uncertain",
    );
  });
  it("authenticates webhooks before parsing and rejects unknown envelopes", async () => {
    const t = setup();
    const plunk = new Emails(components.emails, {
      adapter: plunkAdapter({
        route: "plunk-primary",
        webhookSecret: "test-secret",
      }),
    });
    const request = (body: string, authorized = true) =>
      new Request("https://example.com/plunk", {
        method: "POST",
        headers: authorized ? { authorization: "Bearer test-secret" } : {},
        body,
      });
    expect(
      await t.run(
        async (ctx) =>
          (await plunk.handleWebhook(ctx, request("bad", false))).status,
      ),
    ).toBe(401);
    expect(
      await t.run(
        async (ctx) => (await plunk.handleWebhook(ctx, request("bad"))).status,
      ),
    ).toBe(400);
    expect(
      await t.run(
        async (ctx) =>
          (
            await plunk.handleWebhook(
              ctx,
              request(
                JSON.stringify({
                  type: "contact.unsubscribed",
                  contact: { email: message.to },
                  event: {},
                }),
              ),
            )
          ).status,
      ),
    ).toBe(204);
    expect(
      (await t.query(components.emails.lib.restriction, { email: message.to }))
        ?.marketingUnsubscribed,
    ).toBe(true);
  });
  it("retains uncertain rows during cleanup", async () => {
    const t = setup();
    await expect(
      t.mutation(components.emails.lib.cleanup, { before: Date.now() }),
    ).rejects.toThrow("24 hours");
  });
});
describe("failure recovery", () => {
  it("submits through the host worker with mocked HTTP and keeps credentials out of records", async () => {
    vi.stubEnv("PLUNK_API_KEY", "test-only-key");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        data: { emails: [{ email: "live-fixture-id" }] },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const t = setup();
    const id = await enqueue(t, "live", false);
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    const row = await t.query(components.emails.lib.get, { id });
    expect(row?.state).toBe("accepted");
    expect(row?.providerId).toBe("live-fixture-id");
    expect(JSON.stringify(row)).not.toContain("test-only-key");
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
  it("records delivery events that arrive before send completion", async () => {
    const t = setup();
    const id = await enqueue(t);
    await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    });
    await t.mutation(components.emails.lib.event, {
      route: "plunk-primary",
      key: "early-delivery",
      type: "delivered" as const,
      email: message.to,
      providerId: "early-id",
    });
    await t.mutation(components.emails.lib.finish, {
      id,
      token: 1,
      outcome: { kind: "accepted", providerId: "early-id" },
    });
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "delivered",
    );
  });
  it("requires reconciliation before an uncertain record changes state", async () => {
    const t = setup();
    const id = await enqueue(t);
    await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    });
    await t.mutation(components.emails.lib.finish, {
      id,
      token: 1,
      outcome: { kind: "uncertain", error: "timeout" },
    });
    expect(
      await t.mutation(components.emails.lib.claim, {
        route: "plunk-primary",
        provider: "plunk",
        id,
      }),
    ).toBeNull();
    await t.mutation(components.emails.lib.resolveUncertain, {
      id,
      resolution: { kind: "accepted", providerId: "reconciled-id" },
    });
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "accepted",
    );
  });
});

it("a future scheduled message does not block an immediate message", async () => {
  const t = setup();
  await enqueue(t, "future", true, Date.now() + 86400000);
  const id = await enqueue(t, "immediate");
  expect(
    (await t.query(components.emails.lib.get, { id }))?.scheduledAt,
  ).toBeLessThan(Date.now() + 1000);
});

it("keeps uncertain records and restrictions while removing old completed records", async () => {
  const t = setup();
  const completed = await enqueue(t, "completed");
  await t.mutation(components.emails.lib.claim, {
    route: "plunk-primary",
    provider: "plunk",
    id: completed,
  });
  await t.mutation(components.emails.lib.finish, {
    id: completed,
    token: 1,
    outcome: { kind: "test" },
  });
  vi.setSystemTime(Date.now() + 1001);
  const uncertain = await enqueue(t, "uncertain");
  await t.mutation(components.emails.lib.claim, {
    route: "plunk-primary",
    provider: "plunk",
    id: uncertain,
  });
  await t.mutation(components.emails.lib.finish, {
    id: uncertain,
    token: 1,
    outcome: { kind: "uncertain", error: "timeout" },
  });
  await t.mutation(components.emails.lib.restrict, {
    email: message.to,
    blocked: true,
    marketingUnsubscribed: true,
  });
  vi.setSystemTime(Date.now() + 7 * 86400000);
  expect(
    await t.mutation(components.emails.lib.cleanup, {
      before: Date.now() - 86400001,
    }),
  ).toBe(1);
  expect(
    await t.query(components.emails.lib.get, { id: completed }),
  ).toBeNull();
  expect(
    (await t.query(components.emails.lib.get, { id: uncertain }))?.state,
  ).toBe("uncertain");
  expect(
    (await t.query(components.emails.lib.restriction, { email: message.to }))
      ?.blocked,
  ).toBe(true);
});
it("stops rate-limit retries after five claims", async () => {
  const t = setup();
  const id = await enqueue(t);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const row = await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    });
    expect(row?.token).toBe(attempt);
    await t.mutation(components.emails.lib.finish, {
      id,
      token: attempt,
      outcome: { kind: "retry", ambiguous: false, delayMs: 1000 },
    });
    vi.setSystemTime(Date.now() + 1001);
  }
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "failed",
  );
  expect(
    await t.mutation(components.emails.lib.claim, {
      route: "plunk-primary",
      provider: "plunk",
      id,
    }),
  ).toBeNull();
});
it("cannot cancel a claimed email", async () => {
  const t = setup();
  const id = await enqueue(t);
  await t.mutation(components.emails.lib.claim, {
    route: "plunk-primary",
    provider: "plunk",
    id,
  });
  expect(await t.mutation(components.emails.lib.cancel, { id })).toBe(false);
});
it("records a missing API key as failed without network access", async () => {
  vi.stubEnv("PLUNK_API_KEY", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const t = setup();
  const id = await enqueue(t, "missing-key", false);
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "failed",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("preserves an early delivery event during manual reconciliation", async () => {
  const t = setup();
  const id = await enqueue(t);
  await t.mutation(components.emails.lib.claim, {
    route: "plunk-primary",
    provider: "plunk",
    id,
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 1,
    outcome: { kind: "uncertain", error: "timeout" },
  });
  await t.mutation(components.emails.lib.event, {
    route: "plunk-primary",
    key: "delivery-before-reconcile",
    type: "delivered" as const,
    email: message.to,
    providerId: "confirmed",
  });
  await t.mutation(components.emails.lib.resolveUncertain, {
    id,
    resolution: { kind: "accepted", providerId: "confirmed" },
  });
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "delivered",
  );
});
it("does not correlate a delivery event for another recipient", async () => {
  const t = setup();
  const id = await enqueue(t);
  await t.mutation(components.emails.lib.claim, {
    route: "plunk-primary",
    provider: "plunk",
    id,
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 1,
    outcome: { kind: "accepted", providerId: "p1" },
  });
  await t.mutation(components.emails.lib.event, {
    route: "plunk-primary",
    key: "wrong-recipient",
    type: "delivered" as const,
    email: "other@example.com",
    providerId: "p1",
  });
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "accepted",
  );
});
it("rejects oversized UTF-8 webhook bodies before processing events", async () => {
  const t = setup();
  const plunk = new Emails(components.emails, {
    adapter: plunkAdapter({
      route: "plunk-primary",
      webhookSecret: "test-secret",
    }),
  });
  const response = await t.run(
    async (ctx) =>
      (
        await plunk.handleWebhook(
          ctx,
          new Request("https://example.com/webhook", {
            method: "POST",
            headers: { authorization: "Bearer test-secret" },
            body: "😀".repeat(17000),
          }),
        )
      ).status,
  );
  expect(response).toBe(413);
});

it("keeps provider rate limits independent and refuses a changed worker route", async () => {
  const t = setup();
  const id = await enqueue(t);
  const row = await t.query(components.emails.lib.get, { id });
  const other = await t.mutation(components.emails.lib.enqueue, {
    key: "other",
    message,
    worker: row?.worker ?? "",
    testMode: true,
    scheduledAt: Date.now(),
    intervalMs: 1000,
    route: "resend-primary",
    provider: "resend",
    maxAttempts: 5,
    retryWindowMs: 23 * 3600000,
  });
  expect(
    (await t.query(components.emails.lib.get, { id: other }))?.scheduledAt,
  ).toBeLessThan(Date.now() + 10);
  await expect(
    t.mutation(components.emails.lib.claim, {
      id,
      route: "resend-primary",
      provider: "resend",
    }),
  ).rejects.toThrow("route");
  expect((await t.query(components.emails.lib.get, { id }))?.attempts).toBe(0);
});
it("stops delayed retries before a provider deduplication window expires", async () => {
  const t = setup();
  const id = await enqueue(t);
  await t.mutation(components.emails.lib.claim, {
    id,
    route: "plunk-primary",
    provider: "plunk",
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 1,
    outcome: { kind: "retry", delayMs: 1000, ambiguous: true },
  });
  vi.setSystemTime(Date.now() + 24 * 3600000);
  expect(
    await t.mutation(components.emails.lib.claim, {
      id,
      route: "plunk-primary",
      provider: "plunk",
    }),
  ).toBeNull();
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "uncertain",
  );
});
it("preserves ambiguity after a later definitive failure", async () => {
  const t = setup();
  const id = await enqueue(t);
  await t.mutation(components.emails.lib.claim, {
    id,
    route: "plunk-primary",
    provider: "plunk",
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 1,
    outcome: { kind: "retry", delayMs: 1000, ambiguous: true },
  });
  vi.setSystemTime(Date.now() + 1001);
  await t.mutation(components.emails.lib.claim, {
    id,
    route: "plunk-primary",
    provider: "plunk",
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 2,
    outcome: { kind: "failed", error: "credentials revoked" },
  });
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "uncertain",
  );
});
it("isolates identical provider IDs across routes and never downgrades a complaint", async () => {
  const t = setup();
  const id = await enqueue(t);
  await t.mutation(components.emails.lib.claim, {
    id,
    route: "plunk-primary",
    provider: "plunk",
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 1,
    outcome: { kind: "accepted", providerId: "same" },
  });
  await t.mutation(components.emails.lib.event, {
    key: "one",
    route: "resend-primary",
    type: "delivered",
    email: message.to,
    providerId: "same",
  });
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "accepted",
  );
  await t.mutation(components.emails.lib.event, {
    key: "two",
    route: "plunk-primary",
    type: "complained",
    email: message.to,
    providerId: "same",
  });
  await t.mutation(components.emails.lib.event, {
    key: "three",
    route: "plunk-primary",
    type: "delivered",
    email: message.to,
    providerId: "same",
  });
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "complained",
  );
});

it.each(["cancel", "block"] as const)(
  "preserves an ambiguous send when later asked to %s",
  async (operation) => {
    const t = setup();
    const id = await enqueue(t);
    await t.mutation(components.emails.lib.claim, {
      id,
      route: "plunk-primary",
      provider: "plunk",
    });
    await t.mutation(components.emails.lib.finish, {
      id,
      token: 1,
      outcome: { kind: "retry", delayMs: 1000, ambiguous: true },
    });
    if (operation === "cancel") {
      expect(await t.mutation(components.emails.lib.cancel, { id })).toBe(true);
    } else {
      await t.mutation(components.emails.lib.restrict, {
        email: message.to,
        blocked: true,
        marketingUnsubscribed: true,
      });
      vi.setSystemTime(Date.now() + 1001);
      expect(
        await t.mutation(components.emails.lib.claim, {
          id,
          route: "plunk-primary",
          provider: "plunk",
        }),
      ).toBeNull();
    }
    expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
      "uncertain",
    );
  },
);
it("keeps conflicting provider IDs out of delivery correlation", async () => {
  const t = setup();
  const id = await enqueue(t, "first");
  await t.mutation(components.emails.lib.claim, {
    id,
    route: "plunk-primary",
    provider: "plunk",
  });
  await t.mutation(components.emails.lib.finish, {
    id,
    token: 1,
    outcome: { kind: "accepted", providerId: "duplicate" },
  });
  vi.setSystemTime(Date.now() + 1001);
  const other = await enqueue(t, "second");
  await t.mutation(components.emails.lib.claim, {
    id: other,
    route: "plunk-primary",
    provider: "plunk",
  });
  await t.mutation(components.emails.lib.finish, {
    id: other,
    token: 1,
    outcome: { kind: "accepted", providerId: "duplicate" },
  });
  expect((await t.query(components.emails.lib.get, { id: other }))?.state).toBe(
    "uncertain",
  );
  await t.mutation(components.emails.lib.event, {
    route: "plunk-primary",
    key: "delivery",
    type: "delivered",
    providerId: "duplicate",
    email: message.to,
  });
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "delivered",
  );
});
it("retries through the real Resend host worker with one stable request key", async () => {
  const t = setup();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(Response.json({ id: "resend-success" }));
  vi.stubGlobal("fetch", fetcher);
  const { createFunctionHandle } = await import("convex/server");
  const worker = await t.run(() =>
    createFunctionHandle(internal.emails.deliverResend),
  );
  const id = await t.mutation(components.emails.lib.enqueue, {
    key: "resend-host",
    message,
    worker,
    testMode: false,
    scheduledAt: Date.now(),
    intervalMs: 1000,
    route: "resend-primary",
    provider: "resend",
    maxAttempts: 5,
    retryWindowMs: 23 * 3600000,
  });

  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "queued",
  );
  vi.advanceTimersByTime(2001);
  await t.finishInProgressScheduledFunctions();
  expect((await t.query(components.emails.lib.get, { id }))?.state).toBe(
    "accepted",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]?.[1].headers["Idempotency-Key"]).toBe(
    fetcher.mock.calls[1]?.[1].headers["Idempotency-Key"],
  );
  expect(fetcher.mock.calls[0]?.[1].body).toBe(fetcher.mock.calls[1]?.[1].body);
});
it("rejects unsupported Plunk text before enqueue", async () => {
  const t = setup();
  const email = new Emails(components.emails, {
    adapter: plunkAdapter({ route: "plunk-primary" }),
  });
  await expect(
    t.run((ctx) =>
      email.sendEmail(ctx, {
        ...message,
        text: "Plain text",
        idempotencyKey: "text",
        worker: internal.emails.deliver,
      }),
    ),
  ).rejects.toThrow("text override");
  expect(
    (
      await t.query(components.emails.lib.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page,
  ).toHaveLength(0);
});
