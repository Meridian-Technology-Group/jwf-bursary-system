import { defineConfig, configDefaults } from 'vitest/config'
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
    // Agent worktrees under .claude/worktrees/ carry full stale copies of the
    // suite; without this, a local run sweeps every copy (observed: 2,736 test
    // files instead of ~122, with failures only in the stale copies).
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
