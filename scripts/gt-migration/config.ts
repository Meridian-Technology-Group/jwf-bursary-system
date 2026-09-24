/**
 * Environment targeting and paths (04-toolkit.md §3).
 *
 * The toolkit loads ONLY `.env.migration.<env>` — never `.env` or
 * `.env.local` — and refuses to start when the target does not match what
 * the file says it should be. Every command prints its target first.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type MigEnv = 'nonprod' | 'prod'

/** The abandoned project that prod was once mis-pointed at. Never a target. */
const DEAD_PROJECT_REF = 'bzxoepyhmfvydoxfklft'

const REPO_ROOT = resolve(__dirname, '../..')
export const DATA_DIR = process.env.MIG_DATA_DIR ?? resolve(REPO_ROOT, '../data/migration')
export const EXTRACT_DIR = resolve(DATA_DIR, 'extract/20260910')

export interface MigConfig {
  env: MigEnv
  projectRef: string
  databaseUrl: string
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  return out
}

function projectRefOf(url: string): string | null {
  const m = url.match(/(?:postgres(?:ql)?:\/\/[^.]+\.|https:\/\/)([a-z0-9]{20})/)
  return m ? m[1] : null
}

export function loadConfig(env: MigEnv): MigConfig {
  const file = resolve(REPO_ROOT, `.env.migration.${env}`)
  if (!existsSync(file)) throw new Error(`Missing ${file}. See 04-toolkit.md §3.`)
  const vars = parseEnvFile(file)

  if (vars.MIG_ENV !== env) throw new Error(`${file} says MIG_ENV=${vars.MIG_ENV}, expected ${env}`)
  if (process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is set in the environment. The toolkit must not be able to send mail.')
  }
  const expected = vars.MIG_EXPECT_PROJECT_REF
  const urls = [vars.DATABASE_URL, vars.DIRECT_URL, vars.NEXT_PUBLIC_SUPABASE_URL].filter(Boolean)
  for (const url of urls) {
    const ref = projectRefOf(url)
    if (ref === DEAD_PROJECT_REF) throw new Error('Target points at the dead Supabase project. Refusing.')
    if (ref !== expected) throw new Error(`A URL in ${file} targets ${ref}, expected ${expected}. Refusing.`)
  }
  if (!vars.DATABASE_URL) throw new Error(`${file} has no DATABASE_URL`)
  return { env, projectRef: expected, databaseUrl: vars.DATABASE_URL }
}
