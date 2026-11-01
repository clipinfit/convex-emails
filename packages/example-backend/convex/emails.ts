import { Emails } from "@clipin/convex-emails";
import { plunk } from "@clipin/convex-emails/plunk";
import { resend } from "@clipin/convex-emails/resend";
import { v } from "convex/values";
import { components, internal } from "./_generated/api.js";
import {
  httpAction,
  internalMutation,
  internalQuery,
} from "./_generated/server.js";

// Offline by default. Enable live mode only in a controlled test deployment.
const testMode = process.env.EMAIL_TEST_MODE !== "false";
export const primary = new Emails(components.emails, {
  adapter: plunk({ route: "plunk-primary" }),
  testMode,
});
export const secondary = new Emails(components.emails, {
  adapter: resend({ route: "resend-primary" }),
  testMode,
});
export const deliver = primary.worker();
export const deliverResend = secondary.worker();
export const enqueue = internalMutation({
  args: {
    key: v.string(),
    to: v.string(),
    provider: v.optional(v.union(v.literal("plunk"), v.literal("resend"))),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const useResend = args.provider === "resend";
    return (useResend ? secondary : primary).sendEmail(ctx, {
      worker: useResend
        ? internal.emails.deliverResend
        : internal.emails.deliver,
      idempotencyKey: args.key,
      from: process.env.EMAIL_FROM ?? "hello@example.com",
      to: args.to,
      subject: "Convex Emails test",
      html: "<p>Hello from Convex Emails.</p>",
      scheduledAt: args.scheduledAt,
    });
  },
});
export const status = internalQuery({
  args: { id: v.string() },
  handler: (ctx, { id }) => primary.getStatus(ctx, id),
});
export const webhook = httpAction((ctx, req) =>
  primary.handleWebhook(ctx, req),
);
export const resendWebhook = httpAction((ctx, req) =>
  secondary.handleWebhook(ctx, req),
);
