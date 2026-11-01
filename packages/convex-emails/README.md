# @clipin/convex-emails

Persistent email delivery for Convex with Plunk and Resend adapters. Version **0.0.1**, Apache-2.0.

The component owns scheduling, pacing, deduplication, bounded retries, delivery history, and local suppression. Provider adapters own HTTP requests, webhook verification, and retry classification. React Email can render templates to the `html` field.

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

For Plunk, use `plunk({ route: "plunk-primary" })` from `@clipin/convex-emails/plunk`. Set `PLUNK_API_KEY` or `RESEND_API_KEY` in the host deployment. Explicitly disable test mode after you verify the sender and receiver configuration.

A route must remain bound to one provider account. Keep a separate worker and webhook route for each account. Existing jobs do not move when you select a different adapter.

The default is offline. One recipient is supported per job. This package does not manage marketing campaigns or contacts. An ambiguous result can require manual reconciliation. No exactly-once or inbox-placement guarantee is made.

- [Source and local setup](https://github.com/clipinfit/convex-emails)
- [Documentation source](https://github.com/clipinfit/convex-emails/tree/main/apps/web/content/docs)

The source is prepared for 0.0.1. npm publication is a separate release step.
