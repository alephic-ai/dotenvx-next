import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Tests chdir into fixture directories; worker threads can't chdir.
    pool: 'forks',
  },
})
