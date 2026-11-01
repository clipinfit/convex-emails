# convex-emails

Persistent email delivery for Convex, with **Plunk and Resend adapters**.

One component owns the queue, future sends, pacing, retries, and delivery records. An adapter owns the provider request and failure policy. Keep your React Email templates and local preview workflow.

Version **0.0.1**. Apache-2.0. This repository contains the package, example backend, marketing website, and searchable documentation.

## What it does

- Enqueues email with the application mutation and schedules a host worker automatically.
- Deduplicates business keys and binds each record to one provider route.
- Paces each route and retries according to the selected adapter's policy.
- Records unclear outcomes as `uncertain` for review.
- Verifies provider webhooks and tracks delivery, bounces, and complaints.
- Preserves local recipient restrictions across both adapters.
- Runs offline by default.

A route identifies one provider account or transport. It is not a recipient segment. Do not change the account behind a route while it has pending messages.

## Example

Install the package and Convex:

```sh
npm install @clipin/convex-emails convex
```

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import emails from "@clipin/convex-emails/convex.config.js";

const app = defineApp();
app.use(emails);
export default app;
```

```ts
// convex/emails.ts
import { Emails } from "@clipin/convex-emails";
import { resend } from "@clipin/convex-emails/resend";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const email = new Emails(components.emails, {
  adapter: resend({ route: "resend-primary" }),
  // The default records a test result without an HTTP send.
  testMode: true,
});
export const deliver = email.worker();
export const example = internalMutation({
  args: {},
  handler: async (ctx): Promise<string> =>
    email.sendEmail(ctx, {
      worker: internal.emails.deliver,
      idempotencyKey: "welcome:example-user",
      from: "hello@example.com",
      to: "reader@example.com",
      subject: "Welcome aboard",
      html: "<h1>You're in.</h1>",
    }),
});
```

To use Plunk, import `plunk` from `@clipin/convex-emails/plunk` and pass `plunk({ route: "plunk-primary" })`. Before a live send, configure the provider key and verified sender, then set `testMode: false` explicitly.

## Local development

Requirements: Node.js 22 or later and Bun 1.4.0.

```sh
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run test
bun run lint
bun run pack:check
```

Run the website and docs at `http://localhost:3017`:

```sh
bun run --cwd apps/web dev
```

Run the example backend in a separate terminal:

```sh
CONVEX_AGENT_MODE=anonymous bunx convex dev
```

The example uses test mode unless `EMAIL_TEST_MODE=false` is set in that local deployment. No provider account is needed for the tests or offline example.

## Repository

| Path                       | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `packages/convex-emails`   | Component, client, adapters, and tests            |
| `packages/example-backend` | Two host workers and webhook routes               |
| `apps/web`                 | Next.js marketing site and Fumadocs documentation |

## Scope

Version 0.0.1 sends one HTML transactional email per job. It does not manage campaigns, segments, contact imports, DNS, or subscription pages. It does not add attachments, batch delivery, automatic failover, or provider-side scheduling.

The component does not guarantee exactly-once delivery or inbox placement. Resend retries use its replayable idempotency response within a bounded window. Plunk's ambiguous responses stop for reconciliation. A worker that loses its lease also stops for review.

See the [documentation source](apps/web/content/docs), [contribution guide](CONTRIBUTING.md), and [release procedure](RELEASING.md).
