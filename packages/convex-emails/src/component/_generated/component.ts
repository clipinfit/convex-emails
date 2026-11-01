/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        any,
        Name
      >;
      claim: FunctionReference<
        "mutation",
        "internal",
        { id: string; provider: string; route: string },
        any,
        Name
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { before: number },
        any,
        Name
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          intervalMs: number;
          key: string;
          maxAttempts: number;
          message: {
            from: string;
            headers?: Record<string, string>;
            html: string;
            replyTo?: string;
            subject: string;
            text?: string;
            to: string;
          };
          provider: string;
          retryWindowMs: number;
          route: string;
          scheduledAt: number;
          testMode: boolean;
          worker: string;
        },
        any,
        Name
      >;
      event: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          key: string;
          providerId?: string;
          route: string;
          type:
            | "delivered"
            | "bounced"
            | "complained"
            | "unsubscribed"
            | "subscribed";
        },
        any,
        Name
      >;
      finish: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          outcome:
            | { kind: "accepted"; providerId: string }
            | { kind: "test" }
            | { ambiguous: boolean; delayMs: number; kind: "retry" }
            | { error: string; kind: "failed" }
            | { error: string; kind: "uncertain" };
          token: number;
        },
        any,
        Name
      >;
      get: FunctionReference<"query", "internal", { id: string }, any, Name>;
      list: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any,
        Name
      >;
      resolveUncertain: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          resolution:
            | { kind: "accepted"; providerId: string }
            | { kind: "failed"; reason: string };
        },
        any,
        Name
      >;
      restrict: FunctionReference<
        "mutation",
        "internal",
        { blocked: boolean; email: string; marketingUnsubscribed: boolean },
        any,
        Name
      >;
      restriction: FunctionReference<
        "query",
        "internal",
        { email: string },
        any,
        Name
      >;
    };
  };
