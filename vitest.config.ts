import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // tsconfig says `jsx: "preserve"` (Next compiles JSX itself), which makes
  // esbuild fall back to the CLASSIC runtime and emit bare `React.createElement`
  // calls into any .tsx a test imports — `ReferenceError: React is not defined`,
  // since Next's files never import React. Pin the automatic runtime so tests
  // can import .tsx modules (e.g. the submission-PDF route handler) directly.
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
