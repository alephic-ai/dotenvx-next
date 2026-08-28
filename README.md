# @alephic/dotenvx-next

Decrypt [dotenvx](https://dotenvx.com/) env files at runtime in Next.js apps —
no generated `.env` file, no second parser, one loader for dev, build and
deployed functions.

## Why

`dotenvx run -- next build` only decorates the build process. On Vercel the
function starts with the platform env alone, so nothing decrypts `dotenv/` for
it. Baking a `.env` file at build time hands the values to Next's own loader,
which parses them with a different grammar (`$`, `"` and `\` get mangled).

[dotenvx's Next.js guide](https://dotenvx.com/docs/nextjs/) recommends a third
route: override `@next/env` with `@dotenvx/next-env` via package-manager
`overrides`. That fixes both problems, but by replacing a Next internal, which
has costs this package avoids:

- **It is a fork of `@next/env`, not a wrapper.** The published bundle copies
  Next's `loadEnvConfig`/`processEnv`/`resetEnv` and swaps the parser. When Next
  changes those internals (it has: `onReload`, `__NEXT_PRIVATE_*` handling, FIFO
  detection), the override keeps "working" while diverging, and the failure
  surfaces at runtime on Vercel — after a Next upgrade that touched nothing
  env-related.
- **It only reads root `.env*` files** in Next's fixed order
  (`.env.<mode>.local`, `.env.local`, `.env.<mode>`, `.env`), with `mode` one of
  `development`/`production`/`test`. A `dotenv/` folder or a `.env.preview` for
  Vercel previews has no equivalent.
- **Overrides are per-consumer and fragile.** Every app carries the override
  (pnpm 11: in `pnpm-workspace.yaml`, not `package.json`), every `next` bump
  becomes a "does the override still match" event, and dotenvx's own docs note
  that package managers apply overrides inconsistently.
- **It bundles a second dotenvx.** A minified copy of `@dotenvx/primitives`
  ships inside the override, separate from the `@dotenvx/dotenvx` CLI the app
  encrypts with. Its source is no longer in the dotenvx monorepo; only the
  bundle is inspectable.

This package touches nothing inside Next. It makes the app decrypt its own
committed files, with the private key that is already a platform env var, and
tells Next to ship those files with each function. Next's loader is never
involved, so there is nothing to keep in sync across Next releases.

## Installation

```bash
pnpm add @alephic/dotenvx-next @dotenvx/dotenvx
```

`@dotenvx/dotenvx` is a peer dependency so the CLI you encrypt with and the
runtime that decrypts are the same copy.

Expects the
[Alephic layout](https://github.com/alephic-ai/tools/blob/main/doc/env-vars-and-secrets.md):
encrypted files in `dotenv/` (`.env`, `.env.production`, `.env.preview`,
`.env.local`), keys named `DOTENV_PRIVATE_KEY`, `DOTENV_PRIVATE_KEY_PRODUCTION`,
… in the environment.

### Why `dotenv/` and not the project root

Many CLIs auto-load a root `.env` — Next.js, Vite, Prisma, drizzle-kit, Vercel
CLI, `node --env-file`, and anything built on `dotenv`. None of them can decrypt
dotenvx values, so with encrypted files in the root they would silently inject
the literal `encrypted:…` strings into `process.env`: a `DATABASE_URL` that
looks set but isn't, failing somewhere downstream instead of at the source.
Keeping the files in `dotenv/` makes every load explicit — this package for
Next, `dotenvx run -f dotenv/...` for everything else — and nothing picks them
up by accident.

## Usage

```ts
// next.config.ts
import { withDotenvx } from '@alephic/dotenvx-next'

export default withDotenvx(nextConfig)
// with other wrappers, innermost:
// withWorkflow(withPayload(withDotenvx(nextConfig)))
```

```ts
// src/env.ts — before anything reads process.env
import { loadEnv } from '@alephic/dotenvx-next'
loadEnv()

export const env = createEnv({ /* … */ runtimeEnv: process.env })
```

Then `dev`, `build` and `start` no longer need a dotenvx CLI wrapper. Keep
`dotenvx run -- …` for tools that don't go through Next (`drizzle-kit`,
`vitest`, scripts).

`loadEnv()` is a no-op when `NODE_ENV` is `test`, so importing `env.ts` from a
test never decrypts `dotenv/` with whatever private key the machine has. Seed
the test env explicitly (a vitest `setupFiles` entry), or run the test command
under `dotenvx run -- …` when it needs real values.

## How it works

- `withDotenvx()` calls `loadEnv()` while `next.config.ts` is evaluated — in the
  Next CLI process, before the compiler starts — so `NEXT_PUBLIC_*` values are
  inlined and every server module sees the env. It also traces `dotenv/.env`,
  `.env.production` and `.env.preview` into every server function and marks
  dotenvx as an external package.
- `loadEnv()` in `env.ts` covers deployed functions, where the config file is
  not executed: on first import it reads the traced files and decrypts them.
- Precedence, first match wins: `process.env` → `dotenv/.env.${VERCEL_ENV}` →
  `dotenv/.env.local` → `dotenv/.env`. Platform-injected values (integrations)
  always win. Repeated calls are no-ops.
- When `VERCEL_ENV` is set, a missing `dotenv/.env` or a failed decrypt throws
  (`[MISSING_ENV_FILE]`, `[DECRYPTION_FAILED]`) on the first request. Without it
  — no `dotenv/` yet, CI without keys, `next typegen` on a fresh clone — missing
  files are skipped, decrypt errors are logged, execution continues.
- Under `NODE_ENV=test` nothing is read at all. Next never sets that value; only
  a test runner does.

Not for `proxy.ts`/middleware or edge routes: Next does not apply
`outputFileTracingIncludes` to the proxy trace (verified with Turbopack, Next
16.3), so that function has no `dotenv/` files and sees platform env only. Keep
secrets used there in the platform's env vars.
