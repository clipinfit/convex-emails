# Release 0.0.1

The initial version is 0.0.1. No prerelease label is used. Publication, deployment, and Convex directory submission are separate actions.

## Verify the source

1. Review provider account and deployment checks required for the release.
2. Run `bun install --frozen-lockfile`.
3. Run `bun run lint`, `bun run build`, `bun run typecheck`, and `bun run test`.
4. Run `bun run pack:check` to test the tarball in a fresh consumer.
5. Inspect `npm pack --dry-run` from `packages/convex-emails`.
6. Confirm package version 0.0.1, public exports, license, and repository links.

## Publish only when authorized

Authenticate an npm publisher with access to the `@clipin` scope. Publish from `packages/convex-emails` with `npm publish --access public`. Tag the reviewed commit as `v0.0.1` after publication. Update the changelog and publication status in the docs.

No workflow in this repository publishes automatically. Publication requires maintainer approval.

## Deploy the website separately

The website and docs run at [convex-emails.vercel.app](https://convex-emails.vercel.app). The Vercel project connects to this repository and deploys `main` to production.

Use these project settings when restoring the deployment:

- Root directory: `apps/web`.
- Framework: Next.js.
- Include source files outside the root directory: enabled for the Bun workspace.
- Install and build commands: defined in `apps/web/vercel.json`.
- Environment variables: none required.

Run the source checks before pushing. After deployment, verify the homepage, `/docs`, and documentation search. Website deployment does not publish the npm package or deploy the example backend.

## Submit the component separately

Check the current Convex directory requirements. Submit only after the package is public and the example and documentation URLs are live.
