import {
  createFunctionHandle,
  type FunctionReference,
  type GenericActionCtx,
  type GenericDataModel,
  type GenericMutationCtx,
  type GenericQueryCtx,
  internalActionGeneric,
} from "convex/server";
import { type Infer, v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

import {
  type Adapter,
  type EmailEvent,
  type Message,
  type Outcome,
  validateMessage,
  WebhookError,
} from "./types.js";

export type {
  Adapter,
  AdapterOptions,
  EmailEvent,
  Message,
  Outcome,
} from "./types.js";
export { WebhookError } from "./types.js";
export type EmailOptions = {
  adapter: Adapter;
  testMode?: boolean;
  intervalMs?: number;
  maxAttempts?: number;
};
type MutationCtx = Pick<GenericMutationCtx<GenericDataModel>, "runMutation">;
type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
export const workerArgs = { id: v.string() };
export class Emails {
  private readonly options: EmailOptions & {
    testMode: boolean;
    intervalMs: number;
    maxAttempts: number;
  };
  constructor(
    public readonly component: ComponentApi,
    options: EmailOptions,
  ) {
    this.options = {
      ...options,
      testMode: options.testMode ?? true,
      intervalMs: options.intervalMs ?? 1000,
      maxAttempts: options.maxAttempts ?? 5,
    };
  }
  async sendEmail(
    ctx: MutationCtx,
    args: Message & {
      idempotencyKey: string;
      worker: FunctionReference<
        "action",
        "internal",
        Infer<typeof workerValidator>
      >;
      scheduledAt?: number;
    },
  ) {
    validateMessage(args);
    if (args.text !== undefined && !this.options.adapter.capabilities.text)
      throw new Error("This adapter does not support a text override");
    if (
      args.scheduledAt !== undefined &&
      (!Number.isFinite(args.scheduledAt) || args.scheduledAt <= Date.now())
    )
      throw new Error("scheduledAt must be a future timestamp");
    const { idempotencyKey, worker, scheduledAt, ...message } = args;
    return ctx.runMutation(this.component.lib.enqueue, {
      key: idempotencyKey,
      route: this.options.adapter.route,
      provider: this.options.adapter.name,
      maxAttempts: this.options.maxAttempts,
      retryWindowMs: this.options.adapter.retryWindowMs,
      message,
      worker: await createFunctionHandle(worker),
      testMode: this.options.testMode,
      scheduledAt: scheduledAt ?? Date.now(),
      intervalMs: this.options.intervalMs,
    });
  }
  getStatus(ctx: QueryCtx, id: string) {
    return ctx.runQuery(this.component.lib.get, { id });
  }
  cancel(ctx: MutationCtx, id: string) {
    return ctx.runMutation(this.component.lib.cancel, { id });
  }
  /** Trusted server API: explicitly clearing blocks requires host authorization and evidence. */
  setRestriction(
    ctx: MutationCtx,
    args: { email: string; blocked: boolean; marketingUnsubscribed: boolean },
  ) {
    return ctx.runMutation(this.component.lib.restrict, args);
  }
  /** Define and export this internal action in the host application. Credentials stay in that runtime. */
  worker() {
    return internalActionGeneric({
      args: workerArgs,
      handler: async (ctx, { id }) => {
        const row = await ctx.runMutation(this.component.lib.claim, {
          id,
          route: this.options.adapter.route,
          provider: this.options.adapter.name,
        });
        if (!row) return;
        if (row.testMode) {
          await ctx.runMutation(this.component.lib.finish, {
            id,
            token: row.token,
            outcome: { kind: "test" },
          });
          return;
        }
        let outcome: Outcome;
        try {
          outcome = await this.options.adapter.send(
            row.message,
            `convex-emails:${id}`,
            row.token,
          );
        } catch {
          outcome = {
            kind: "uncertain",
            error: "Adapter threw; inspect the provider before resending",
          };
        }
        await ctx.runMutation(this.component.lib.finish, {
          id,
          token: row.token,
          outcome,
        });
      },
    });
  }
  async handleWebhook(ctx: ActionCtx, request: Request): Promise<Response> {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    // Limit bytes while reading, rather than allocating an unbounded request body.
    const reader = request.body?.getReader();
    if (!reader) return new Response("Invalid event", { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    let raw: string;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 65536) {
          await reader.cancel();
          return new Response("Payload too large", { status: 413 });
        }
        chunks.push(value);
      }
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      raw = new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      return new Response("Invalid event", { status: 400 });
    } finally {
      reader.releaseLock();
    }
    let events: EmailEvent[];
    try {
      events = await this.options.adapter.verifyWebhook(raw, request.headers);
    } catch (error) {
      return new Response("Webhook rejected", {
        status: error instanceof WebhookError ? error.status : 400,
      });
    }
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    const hash = Array.from(new Uint8Array(bytes), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    for (const [index, event] of events.entries()) {
      await ctx.runMutation(this.component.lib.event, {
        ...event,
        key: `${hash}:${index}`,
        route: this.options.adapter.route,
      });
    }
    return new Response(null, { status: 204 });
  }
}
const workerValidator = v.object({ id: v.string() });
