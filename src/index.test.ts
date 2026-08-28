import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEnv, withDotenvx } from './index.ts'

const KEYS = ['FOO', 'BAR', 'VERCEL_ENV'] as const
const UNDECRYPTABLE =
  'DOTENV_PUBLIC_KEY="034c8b8f5b5d2e1e9b7c4c1a5f0d2b3e4a5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f"\nFOO="encrypted:BE9Y7LKANx77X1pv0mFf0Q=="\n'

let dir: string
const originalCwd = process.cwd()
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

function writeEnv(name: string, content: string) {
  writeFileSync(join(dir, 'dotenv', name), content)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dotenvx-next-'))
  mkdirSync(join(dir, 'dotenv'))
  process.chdir(dir)
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  // vitest sets NODE_ENV=test, which makes loadEnv() a no-op.
  vi.stubEnv('NODE_ENV', 'development')
})

afterEach(() => {
  vi.unstubAllEnvs()
  process.chdir(originalCwd)
  rmSync(dir, { force: true, recursive: true })
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('loadEnv', () => {
  it('loads .env.local over .env when VERCEL_ENV is unset', () => {
    writeEnv('.env', 'FOO=base\nBAR=base\n')
    writeEnv('.env.local', 'FOO=local\n')
    loadEnv()
    expect(process.env.FOO).toBe('local')
    expect(process.env.BAR).toBe('base')
  })

  it('loads .env.${VERCEL_ENV} first', () => {
    process.env.VERCEL_ENV = 'production'
    writeEnv('.env', 'FOO=base\nBAR=base\n')
    writeEnv('.env.local', 'FOO=local\n')
    writeEnv('.env.production', 'BAR=prod\n')
    loadEnv()
    expect(process.env.FOO).toBe('local')
    expect(process.env.BAR).toBe('prod')
  })

  it('does not fall back to a root .env when dotenv/ has no files', () => {
    writeFileSync(join(dir, '.env'), 'FOO=root\n')
    loadEnv()
    expect(process.env.FOO).toBeUndefined()
  })

  it('never overrides keys already in process.env', () => {
    process.env.FOO = 'platform'
    writeEnv('.env', 'FOO=base\n')
    loadEnv()
    expect(process.env.FOO).toBe('platform')
  })

  it('tolerates missing optional files', () => {
    process.env.VERCEL_ENV = 'preview'
    writeEnv('.env', 'FOO=base\n')
    expect(() => loadEnv()).not.toThrow()
    expect(process.env.FOO).toBe('base')
  })

  it('skips a missing base file when not deployed', () => {
    expect(() => loadEnv()).not.toThrow()
  })

  it('is a no-op under a test runner (NODE_ENV=test)', () => {
    vi.stubEnv('NODE_ENV', 'test')
    writeEnv('.env', 'FOO=base\n')
    loadEnv()
    expect(process.env.FOO).toBeUndefined()
  })

  it('throws on a missing base file when deployed', () => {
    process.env.VERCEL_ENV = 'production'
    expect(() => loadEnv()).toThrow(/MISSING_ENV_FILE/)
  })

  it('leaves undecryptable values as ciphertext when not deployed', () => {
    writeEnv('.env', UNDECRYPTABLE)
    loadEnv()
    expect(process.env.FOO).toBe('encrypted:BE9Y7LKANx77X1pv0mFf0Q==')
  })

  it('throws on undecryptable values when deployed', () => {
    process.env.VERCEL_ENV = 'production'
    writeEnv('.env', UNDECRYPTABLE)
    expect(() => loadEnv()).toThrow(/DECRYPTION_FAILED/)
  })
})

describe('withDotenvx', () => {
  it('merges tracing includes and external packages', () => {
    writeEnv('.env', 'FOO=base\n')
    const result = withDotenvx({
      outputFileTracingIncludes: { '*': ['./existing'], '/api': ['./x'] },
      serverExternalPackages: ['pg'],
      typedRoutes: true,
    })
    expect(result.typedRoutes).toBe(true)
    expect(result.outputFileTracingIncludes).toEqual({
      '*': [
        './existing',
        './dotenv/.env',
        './dotenv/.env.production',
        './dotenv/.env.preview',
      ],
      '/api': ['./x'],
    })
    expect(result.serverExternalPackages).toEqual([
      'pg',
      '@dotenvx/dotenvx',
      '@alephic/dotenvx-next',
    ])
    expect(process.env.FOO).toBe('base')
  })
})
