import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "convex-emails-consumer-"));
try {
  const output = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", temp],
    { cwd: join(root, "packages/convex-emails"), encoding: "utf8" },
  );
  const [pack] = JSON.parse(output);
  const names = pack.files.map((file) => file.path);
  for (const required of [
    "dist/client/index.js",
    "dist/client/index.d.ts",
    "dist/adapters/plunk.js",
    "dist/adapters/resend.js",
    "dist/component/convex.config.js",
    "dist/component/_generated/component.d.ts",
    "src/test.ts",
    "LICENSE",
    "README.md",
  ])
    if (!names.includes(required)) throw new Error(`Missing ${required}`);
  for (const name of names)
    if (
      name.includes(".env") ||
      name.includes("node_modules/") ||
      name.endsWith(".test.ts") ||
      /(^|\/)(docs|internal|private)(\/|$)/.test(name) ||
      /(prd|review-notes|decision-log)/i.test(name)
    )
      throw new Error(`Unexpected packed file ${name}`);
  writeFileSync(
    join(temp, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(temp, pack.filename),
      "convex@1.49.0",
      "typescript@7.0.2",
      "convex-test@0.0.66",
      "vitest@5.0.5",
      "vite@8.3.5",
    ],
    { cwd: temp, stdio: "pipe" },
  );
  writeFileSync(
    join(temp, "check.mjs"),
    `import {Emails} from '@clipin/convex-emails';\nimport {plunk} from '@clipin/convex-emails/plunk';\nimport {resend} from '@clipin/convex-emails/resend';\nimport config from '@clipin/convex-emails/convex.config.js';\nif(typeof plunk!=='function'||typeof resend!=='function') throw new Error('Missing adapters');\nif(typeof Emails!=='function'||!config) throw new Error('Invalid exports');\n`,
  );
  execFileSync("node", ["check.mjs"], { cwd: temp, stdio: "inherit" });
  writeFileSync(
    join(temp, "consumer.ts"),
    `import {Emails} from '@clipin/convex-emails';\nimport {plunk} from '@clipin/convex-emails/plunk';\nimport {resend} from '@clipin/convex-emails/resend';\nimport type {ComponentApi} from '@clipin/convex-emails/_generated/component.js';\nimport {defineApp} from 'convex/server';\nimport config from '@clipin/convex-emails/convex.config.js';\ndeclare const component:ComponentApi;\nconst emails=new Emails(component,{adapter:plunk({route:'plunk-test'})});\nexport const worker=emails.worker();\nexport const other=new Emails(component,{adapter:resend({route:'resend-test'})}).worker();\nconst app=defineApp();app.use(config);\n`,
  );
  execFileSync(
    join(temp, "node_modules/.bin/tsc"),
    [
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--moduleResolution",
      "bundler",
      "--module",
      "esnext",
      "--target",
      "es2022",
      "consumer.ts",
    ],
    { cwd: temp, stdio: "inherit" },
  );
  writeFileSync(
    join(temp, "vitest.config.ts"),
    `import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',server:{deps:{inline:['@clipin/convex-emails']}}}});
`,
  );
  writeFileSync(
    join(temp, "package.test.ts"),
    `import {expect,it} from 'vitest';
import {convexTest} from 'convex-test';
import {componentsGeneric,defineSchema} from 'convex/server';
import {register} from '@clipin/convex-emails/test';
it('loads the packed component through its public test helper',async()=>{
 const t=convexTest(defineSchema({}),{'./_generated/server.ts':async()=>({})});
 register(t);
 const result=await t.query(componentsGeneric().emails.lib.list,{paginationOpts:{numItems:1,cursor:null}});
 expect(result.page).toEqual([]);
 expect(result.isDone).toBe(true);
});
`,
  );
  execFileSync(join(temp, "node_modules/.bin/vitest"), ["run"], {
    cwd: temp,
    stdio: "inherit",
  });
  console.log(
    `Package smoke passed: ${names.length} files, fresh consumer imports, TypeScript compile, and test helper execution.`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
