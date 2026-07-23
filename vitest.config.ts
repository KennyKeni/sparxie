import { defineConfig } from 'vitest/config'

export const maintainedTestIncludes = [
  'scripts/**/*.test.mjs',
  'src/**/*.test.{ts,tsx}',
]

export default defineConfig({
  test: {
    environment: 'node',
    include: maintainedTestIncludes,
  },
})
