# Website and documentation

Next.js App Router, React, Tailwind CSS, and Fumadocs. The homepage uses a custom flat design. The docs use the standard navigation, table of contents, search, and theme controls.

```sh
bun install --frozen-lockfile
bun run --cwd apps/web dev
```

Open `http://localhost:3017`. The production build uses `bun run --cwd apps/web build`. Use `bun run --cwd apps/web start` to serve that build.

Edit `app/page.tsx` and `app/global.css` for the homepage. Edit `content/docs/*.mdx` and `content/docs/meta.json` for documentation. `components/provider-demo.tsx` contains the local provider switcher. The switcher never sends email.

No hosting project, production domain, or deployment is created by these commands.
