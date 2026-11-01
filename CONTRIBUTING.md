# Contribute

Use Node.js 22 or later and Bun 1.4.0. Install with `bun install --frozen-lockfile`.

Run `bun run format`, `bun run lint`, `bun run build`, `bun run typecheck`, `bun run test`, and `bun run pack:check` before a pull request.

Keep provider-specific policy in `src/adapters`. Keep persistence and orchestration in `src/component`. Do not add provider names to common lifecycle decisions. Add behavioral tests for changed failure paths.

Use the anonymous local backend for Convex code generation:

```sh
CONVEX_AGENT_MODE=anonymous bunx convex dev --once --typecheck disable
bun run --cwd packages/convex-emails codegen
```

Never include provider credentials, real recipients, account identifiers, or local deployment files in a commit. Keep the example in test mode. Live email tests need an approved recipient and a test account.

Document capability limits. Do not claim exactly-once delivery, provider parity, or production validation without evidence.
