---
'@alephic/dotenvx-next': patch
---

`loadEnv()` is now a no-op when `NODE_ENV` is `test`. Importing `env.ts` from
a test used to decrypt `dotenv/` with whatever private key the machine had (and
leave ciphertext in `process.env` without one), so tests silently reached past
their seeded env. Seed the test env explicitly, or run the test command under
`dotenvx run -- …` when it needs real values.
