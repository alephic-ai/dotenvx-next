# @alephic/dotenvx-next

## 0.2.1

### Patch Changes

- [#1](https://github.com/alephic-ai/dotenvx-next/pull/1)
  [`d9bdf47`](https://github.com/alephic-ai/dotenvx-next/commit/d9bdf4709bbc6c4c6c8a65586606338d4cfbe763)
  Thanks [@gmathieu](https://github.com/gmathieu)! - `loadEnv()` is now a no-op
  when `NODE_ENV` is `test`. Importing `env.ts` from a test used to decrypt
  `dotenv/` with whatever private key the machine had (and leave ciphertext in
  `process.env` without one), so tests silently reached past their seeded env.
  Seed the test env explicitly, or run the test command under `dotenvx run -- …`
  when it needs real values.

## 0.2.0

### Minor Changes

- - Add `withDotenvx` and `loadEnv` helpers to decrypt dotenvx env files at
    runtime in Next.js apps, without generating a `.env` file

## 0.1.0

### Minor Changes

- Initial release: `loadEnv()` decrypts `dotenv/` into `process.env` at runtime
  and `withDotenvx()` ships the files into Next.js function bundles.
