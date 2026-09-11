#!/usr/bin/env node
/**
 * Guards the failure that broke the Part 5 deploy on 11 Sep 2026.
 *
 * A generated multi-row INSERT lost the semicolon on its final row, so the
 * statement that followed parsed as a continuation of the same VALUES list and
 * Postgres reported `syntax error at or near "INSERT"`. Nothing caught it
 * before merge: no test executes migration SQL, so it surfaced only at
 * `prisma migrate deploy`, where it left the migration started-but-unfinished
 * and blocked every later deploy until the record was cleared by hand.
 *
 * The check is narrow on purpose. It splits on `;` and looks for markers that
 * can only ever begin a statement, never continue one. That is enough to catch
 * a missing terminator without the false positives a line-based heuristic
 * produces on legitimate multi-line ALTER/UPDATE statements.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "prisma/migrations";

/** Keywords that cannot appear as a continuation line of another statement. */
const STATEMENT_STARTERS =
  /^\s*(INSERT\s+INTO|CREATE\s+(UNIQUE\s+)?INDEX|CREATE\s+TYPE|CREATE\s+TABLE|DROP\s+INDEX|DROP\s+TABLE)\b/i;

/**
 * Blank out anything whose contents must not be parsed as SQL structure:
 * string literals, dollar-quoted blocks (a `DO $$ ... $$` body contains its own
 * semicolons), and comments. Order matters — literals go first so that a `--`
 * or `$$` inside a string is not mistaken for a comment or a block.
 */
function sanitise(sql) {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, "$$$$")
    .replace(/--[^\n]*/g, "");
}

let failures = 0;

for (const dir of readdirSync(ROOT).sort()) {
  const file = join(ROOT, dir, "migration.sql");
  if (!existsSync(file)) continue;

  const statements = sanitise(readFileSync(file, "utf8")).split(";");
  // The final chunk is whatever follows the last `;` — must be blank.
  const tail = statements.pop();
  if (tail && tail.trim()) {
    console.error(`${file}\n    file ends without a terminating semicolon`);
    failures++;
  }

  for (const stmt of statements) {
    const lines = stmt.split("\n").filter((l) => l.trim());
    // A starter on any line but the first means the previous statement was
    // never terminated and this one got swallowed into it.
    const swallowed = lines.slice(1).find((l) => STATEMENT_STARTERS.test(l));
    if (swallowed) {
      console.error(
        `${file}\n    a statement begins before the previous one is terminated:\n    ${swallowed.trim().slice(0, 90)}`
      );
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} migration SQL problem(s) found.`);
  process.exit(1);
}
console.log(`migration SQL: all statements terminated`);
