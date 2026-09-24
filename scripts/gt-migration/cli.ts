/**
 * GT migration toolkit — command router.
 *
 *   npm run mig -- calc --env nonprod [--debt as-entered|x5] [--variant <name>]
 *
 * Only `calc` exists so far; the rest of 04-toolkit.md §2 is built in M3.
 */
import { loadConfig, type MigEnv } from './config'
import { runCalc } from './calc/run'
import { DEFAULT_RULES, type MappingRules } from './build/map-assessment'

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const env = flag(args, 'env') as MigEnv | undefined
  if (env !== 'nonprod' && env !== 'prod') throw new Error('--env nonprod|prod is required')

  switch (command) {
    case 'calc': {
      const rules: MappingRules = { ...DEFAULT_RULES }
      const debt = flag(args, 'debt')
      if (debt === 'as-entered') rules.debt = 'AS_ENTERED'
      else if (debt === 'x5') rules.debt = 'TIMES_REPAYMENT_YEARS'
      else if (debt) throw new Error('--debt as-entered|x5')
      await runCalc(loadConfig(env), rules, flag(args, 'variant'))
      return
    }
    default:
      throw new Error(`Unknown command: ${command ?? '(none)'}. Available: calc`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
