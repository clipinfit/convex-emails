import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export const message = v.object({
  from: v.string(),
  to: v.string(),
  subject: v.string(),
  html: v.string(),
  text: v.optional(v.string()),
  replyTo: v.optional(v.string()),
  headers: v.optional(v.record(v.string(), v.string())),
});
export const state = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("accepted"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
  v.literal("uncertain"),
  v.literal("cancelled"),
  v.literal("suppressed"),
  v.literal("test"),
);
export default defineSchema({
  emails: defineTable({
    key: v.string(),
    route: v.string(),
    provider: v.string(),
    maxAttempts: v.number(),
    retryWindowMs: v.number(),
    ambiguous: v.optional(v.boolean()),
    message,
    worker: v.string(),
    intervalMs: v.number(),
    testMode: v.boolean(),
    state,
    attempts: v.number(),
    recoveries: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    scheduledAt: v.number(),
    firstAttemptAt: v.optional(v.number()),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    jobId: v.optional(v.id("_scheduled_functions")),
    token: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_provider", ["route", "providerId"])
    .index("by_state_updated", ["state", "updatedAt"]),
  restrictions: defineTable({
    email: v.string(),
    blocked: v.boolean(),
    marketingUnsubscribed: v.boolean(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),
  dispatch: defineTable({ route: v.string(), nextAt: v.number() }).index(
    "by_route",
    ["route"],
  ),
  slots: defineTable({ route: v.string(), nextAt: v.number() }).index(
    "by_route",
    ["route"],
  ),
  events: defineTable({
    route: v.string(),
    key: v.string(),
    type: v.string(),
    providerId: v.optional(v.string()),
    email: v.string(),
    receivedAt: v.number(),
  })
    .index("by_key", ["route", "key"])
    .index("by_provider", ["route", "providerId"])
    .index("by_delivery", ["route", "providerId", "email", "type"]),
});
