import { config } from '@dotenvx/dotenvx'
import { type NextConfig } from 'next'
import { existsSync } from 'node:fs'

const DOTENV_DIR = 'dotenv'

/**
 * Decrypt the committed `dotenv/` files into `process.env`, resolved from the
 * current working directory. Keys that are already set win, so platform env
 * (Vercel, Neon integrations) takes precedence and repeated calls are no-ops.
 *
 * Precedence, first match wins: `process.env`, `dotenv/.env.${VERCEL_ENV}`,
 * `dotenv/.env.local`, `dotenv/.env`.
 *
 * When `VERCEL_ENV` is set (a deployed build or function), the base
 * `dotenv/.env` must exist and every value must decrypt; otherwise this throws
 * so misconfiguration fails on the first request instead of leaking ciphertext
 * into the app. Elsewhere — a repo without `dotenv/` yet, CI without keys,
 * `next typegen` on a fresh clone — missing files are skipped and decrypt
 * errors are logged, as the dotenvx CLI does. `NODE_ENV` is deliberately not
 * the deployed switch: every Next command except `dev` sets it to
 * `production`, including `typegen`.
 *
 * Under a test runner (`NODE_ENV=test`, which Next itself never sets) this is
 * a no-op: tests seed their env explicitly or run under `dotenvx run`, never
 * decrypt the real files with whatever private key the machine has.
 */
export function loadEnv() {
  if (process.env.NODE_ENV === 'test') return
  const vercelEnv = process.env.VERCEL_ENV
  const deployed = Boolean(vercelEnv)
  const base = `${DOTENV_DIR}/.env`
  const files = [
    ...(vercelEnv ? [`${DOTENV_DIR}/.env.${vercelEnv}`] : []),
    `${DOTENV_DIR}/.env.local`,
    base,
  ]
  const path = files.filter(
    (file) => (deployed && file === base) || existsSync(file),
  )
  // An empty path list makes dotenvx fall back to its defaults (root `.env`).
  if (path.length === 0) return
  config({
    path,
    quiet: true, // info only; errors still print
    strict: deployed,
  })
}

/**
 * Wrap a Next.js config so the app can decrypt `dotenv/` on its own:
 *
 * - loads env now, in the Next CLI process, so `dev`, `build` and `start`
 *   need no dotenvx CLI wrapper and `NEXT_PUBLIC_*` values are inlined;
 * - traces the committed `dotenv/` files into every server function, so
 *   `loadEnv()` can read them at runtime where the config file isn't
 *   executed (Vercel);
 * - keeps dotenvx unbundled so it stays a plain `require` that reads files.
 *
 * Apply innermost when composing with other wrappers, e.g.
 * `withWorkflow(withPayload(withDotenvx(nextConfig)))`.
 */
export function withDotenvx(nextConfig: NextConfig): NextConfig {
  loadEnv()
  return {
    ...nextConfig,
    outputFileTracingIncludes: {
      ...nextConfig.outputFileTracingIncludes,
      '*': [
        ...(nextConfig.outputFileTracingIncludes?.['*'] ?? []),
        `./${DOTENV_DIR}/.env`,
        `./${DOTENV_DIR}/.env.production`,
        `./${DOTENV_DIR}/.env.preview`,
      ],
    },
    serverExternalPackages: [
      ...(nextConfig.serverExternalPackages ?? []),
      '@dotenvx/dotenvx',
      '@alephic/dotenvx-next',
    ],
  }
}
