/// <reference types="vite/client" />
import {
  createFunctionHandle,
  internalActionGeneric,
  makeFunctionReference,
} from "convex/server";
import { v } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import schema from "./schema.js";

const modules = {
  ...import.meta.glob("./**/*.ts"),
  "./worker.ts": async () => ({
    // Models a host action that returns before claiming the job.
    deliver: internalActionGeneric({
      args: { id: v.string() },
      handler: async () => null,
    }),
  }),
};
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const worker = await t.run(() =>
    createFunctionHandle(makeFunctionReference<"action">("worker:deliver")),
  );
  const id = await t.mutation(api.lib.enqueue, {
    key: "recovery",
    route: "test",
    provider: "test",
    maxAttempts: 5,
    retryWindowMs: 23 * 3600000,
    worker,
    testMode: true,
    scheduledAt: Date.now(),
    intervalMs: 1000,
    message: {
      from: "hello@example.com",
      to: "reader@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    },
  });
  return { t, id };
}
it("recovers an unclaimed job five times and then stops", async () => {
  const { t, id } = await setup();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const row = await t.query(api.lib.get, { id });
  expect(row).toMatchObject({ state: "failed", attempts: 0, recoveries: 5 });
});
it("does not recover a cancelled job", async () => {
  const { t, id } = await setup();
  await t.mutation(api.lib.cancel, { id });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const row = await t.query(api.lib.get, { id });
  expect(row?.state).toBe("cancelled");
  expect(row?.recoveries).toBeUndefined();
});
it("ignores an expired lease for a stale claim token", async () => {
  const { t, id } = await setup();
  await t.mutation(api.lib.claim, { id, route: "test", provider: "test" });
  await t.mutation(internal.lib.expire, { id, token: 999 });
  expect((await t.query(api.lib.get, { id }))?.state).toBe("processing");
});
