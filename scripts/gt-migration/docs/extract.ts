/**
 * M8 steps 1–3: decrypt only the selected documents out of DocumentStore.zip
 * and reconcile them (`mig docs-extract`). Environment-independent: it reads
 * the archive and the canonical, never a database.
 *
 *   1. select   — selectDocuments() over the latest canonical (S26 window)
 *   2. locate   — every selected file in the archive's own listing (no password
 *                 needed: a zip's directory is not encrypted)
 *   3. extract  — `7zz x` with a list file; files already on disk at the
 *                 archive's size are not extracted again
 *   4. reconcile— size = archive size, then sniff + sha-256 each file
 *
 * Writes docs-staging/selection.json, which `mig load --phase documents` reads.
 * The password comes from MIG_ARCHIVE_PASSWORD or ../data/migration/.archive-password
 * (mode 0600) and reaches 7-Zip on stdin, never on its command line.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sniffContentType } from '../../../src/lib/storage/sniff'
import { computeContentDigest, DIGEST_SAMPLE_BYTES } from '../../../src/lib/documents/content-digest'
import { DATA_DIR, DOC_ARCHIVE, DOCS_STAGING_DIR, EXTRACT_DIR } from '../config'
import { latestCanonical } from '../calc/run'
import { readGrantDocs, selectDocuments, type DocAccount, type SelectedDoc } from './select'

export const SELECTION_FILE = resolve(DOCS_STAGING_DIR, 'selection.json')
const FILES_DIR = resolve(DOCS_STAGING_DIR, 'files')
const INDEX_FILE = resolve(DOCS_STAGING_DIR, 'archive-index.tsv')

export interface StagedDoc extends SelectedDoc {
  /** Relative to docs-staging/files. */
  localPath: string
  size: number
  mime: string
  sha256: string
  /** The app's CF-28 fingerprint (size + first 64 KB). */
  contentDigest: string
}

export interface StagedSelection {
  canonicalHash: string
  builtAt: string
  window: string
  docs: StagedDoc[]
}

export function readStagedSelection(): StagedSelection {
  if (!existsSync(SELECTION_FILE)) throw new Error('No docs-staging/selection.json: run `mig docs-extract` first')
  return JSON.parse(readFileSync(SELECTION_FILE, 'utf8'))
}

function run7z(args: string[], password?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((ok, fail) => {
    const p = spawn('7zz', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', (d) => (stdout += d))
    p.stderr.on('data', (d) => (stderr += d))
    p.on('error', (e) => fail(new Error(`7zz: ${e.message} (brew install sevenzip)`)))
    p.on('close', (code) => ok({ code: code ?? 1, stdout, stderr }))
    if (password != null) p.stdin.write(`${password}\n`)
    p.stdin.end()
  })
}

/** name → uncompressed size, from `7zz l -slt`; cached, since listing 114k entries takes a while. */
async function archiveIndex(): Promise<Map<string, number>> {
  const archiveStat = statSync(DOC_ARCHIVE)
  const stamp = `# ${archiveStat.size} ${archiveStat.mtimeMs}`
  if (existsSync(INDEX_FILE)) {
    const [head, ...lines] = readFileSync(INDEX_FILE, 'utf8').split('\n')
    if (head === stamp) return new Map(lines.filter(Boolean).map((l) => l.split('\t')).map(([n, s]) => [n, Number(s)]))
  }
  const { code, stdout, stderr } = await run7z(['l', '-slt', '-ba', '-sccUTF-8', DOC_ARCHIVE])
  if (code !== 0) throw new Error(`7zz l failed: ${stderr.trim().split('\n').pop()}`)
  const index = new Map<string, number>()
  let path: string | null = null
  for (const line of stdout.split('\n')) {
    if (line.startsWith('Path = ')) path = line.slice(7)
    else if (line.startsWith('Size = ') && path != null) {
      index.set(path, Number(line.slice(7)))
      path = null
    }
  }
  writeFileSync(INDEX_FILE, [stamp, ...Array.from(index, ([n, s]) => `${n}\t${s}`)].join('\n'), { mode: 0o600 })
  return index
}

function readPassword(): string {
  if (process.env.MIG_ARCHIVE_PASSWORD) return process.env.MIG_ARCHIVE_PASSWORD
  const file = resolve(DATA_DIR, '.archive-password')
  if (!existsSync(file)) throw new Error(`No archive password: set MIG_ARCHIVE_PASSWORD or write ${file} (chmod 600)`)
  if ((statSync(file).mode & 0o077) !== 0) throw new Error(`${file} is readable by others: chmod 600 it`)
  return readFileSync(file, 'utf8').replace(/\r?\n$/, '')
}

function head(path: string, n: number): Buffer {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(n)
    const read = readSync(fd, buf, 0, n, 0)
    return buf.subarray(0, read)
  } finally {
    closeSync(fd)
  }
}

function sha256File(path: string): Promise<string> {
  return new Promise((ok, fail) => {
    const h = createHash('sha256')
    createReadStream(path)
      .on('data', (d) => h.update(d))
      .on('end', () => ok(h.digest('hex')))
      .on('error', fail)
  })
}

export async function extractDocuments(opts: { only?: string[] } = {}) {
  const { hash, dir } = latestCanonical()
  const accounts: DocAccount[] = JSON.parse(readFileSync(resolve(dir, 'accounts.json'), 'utf8')).accounts
  const selected = opts.only?.length ? accounts.filter((a) => opts.only!.includes(a.key)) : accounts
  const { docs, countMismatches } = selectDocuments(selected, readGrantDocs(resolve(EXTRACT_DIR, 'gt_grantdocs.tsv')))
  console.log(`canonical: ${hash} | archive: ${DOC_ARCHIVE}`)
  console.log(`selected: ${docs.length} documents across ${new Set(docs.map((d) => d.accountKey)).size} accounts`)
  if (countMismatches.length) {
    countMismatches.forEach((m) => console.log(`  ${m.key}: selected ${m.selected}, canonical says ${m.canonical}`))
    throw new Error(`${countMismatches.length} accounts select a different number of documents than the canonical reviewed`)
  }

  mkdirSync(FILES_DIR, { recursive: true, mode: 0o700 })
  const index = await archiveIndex()
  const lower = new Map(Array.from(index.keys()).map((k) => [k.toLowerCase(), k]))
  const located = docs.map((d) => ({ d, name: index.has(d.archivePath) ? d.archivePath : lower.get(d.archivePath.toLowerCase()) }))
  const missing = located.filter((x) => !x.name)
  if (missing.length) {
    const byAccount = missing.reduce<Record<string, number>>((m, x) => ((m[x.d.accountKey] = (m[x.d.accountKey] ?? 0) + 1), m), {})
    throw new Error(`${missing.length} selected documents are not in the archive: ${JSON.stringify(byAccount)}`)
  }

  const todo = located.filter(({ name }) => {
    const p = resolve(FILES_DIR, name!)
    return !existsSync(p) || statSync(p).size !== index.get(name!)
  })
  const bytes = located.reduce((s, x) => s + index.get(x.name!)!, 0)
  console.log(`located: ${located.length} (${(bytes / 1e9).toFixed(2)} GB) | already extracted: ${located.length - todo.length} | to extract: ${todo.length}`)

  if (todo.length) {
    const listFile = resolve(DOCS_STAGING_DIR, 'extract-list.txt')
    writeFileSync(listFile, todo.map((x) => x.name).join('\n') + '\n', { mode: 0o600 })
    const started = Date.now()
    // -spd: names are literal (GT filenames carry [ ] and *); -bso0/-bsp0: no per-file output.
    const { code, stderr } = await run7z(
      ['x', DOC_ARCHIVE, `-o${FILES_DIR}`, '-y', '-spd', '-sccUTF-8', '-scsUTF-8', '-bso0', '-bsp0', `@${listFile}`],
      readPassword(),
    )
    if (code !== 0) {
      const wrong = /Wrong password/i.test(stderr)
      throw new Error(wrong ? 'Wrong archive password' : `7zz x exited ${code}: ${stderr.split('\n').filter((l) => /ERROR/i.test(l)).length} errors`)
    }
    console.log(`extracted ${todo.length} in ${Math.round((Date.now() - started) / 1000)}s`)
  }

  // Reconcile: every file present at the archive's size; then fingerprint it.
  const staged: StagedDoc[] = []
  const bad: string[] = []
  for (const { d, name } of located) {
    const p = resolve(FILES_DIR, name!)
    if (!existsSync(p) || statSync(p).size !== index.get(name!)) {
      bad.push(d.accountKey)
      continue
    }
    const size = statSync(p).size
    const sample = head(p, DIGEST_SAMPLE_BYTES)
    staged.push({
      ...d,
      localPath: name!,
      size,
      mime: sniffContentType(sample).contentType ?? d.declaredMime,
      sha256: await sha256File(p),
      contentDigest: computeContentDigest(sample, size),
    })
  }
  if (bad.length) throw new Error(`${bad.length} files missing or the wrong size after extraction (accounts ${Array.from(new Set(bad)).join(', ')})`)

  const selection: StagedSelection = { canonicalHash: hash, builtAt: new Date().toISOString(), window: 'S26 + docsWindow rulings', docs: staged }
  writeFileSync(SELECTION_FILE, JSON.stringify(selection), { mode: 0o600 })
  report(staged)
  console.log(`reconciled ${staged.length}/${docs.length} | selection: ${SELECTION_FILE}`)
}

function report(docs: StagedDoc[]) {
  const by = <K extends string>(f: (d: StagedDoc) => K) =>
    docs.reduce<Record<string, number>>((m, d) => ((m[f(d)] = (m[f(d)] ?? 0) + 1), m), {})
  console.log(`  by slot: ${JSON.stringify(by((d) => d.slot))}`)
  console.log(`  by type: ${JSON.stringify(by((d) => d.mime))}`)
  const mismatched = docs.filter((d) => d.declaredMime !== d.mime && d.declaredMime !== 'application/octet-stream').length
  console.log(`  extension disagrees with the bytes (bytes win): ${mismatched}`)
  const noPreview = docs.filter((d) => !/^(application\/pdf|image\/(jpeg|png))$/.test(d.mime)).length
  console.log(`  will download rather than preview (not PDF/JPEG/PNG): ${noPreview}`)
  for (const mb of [20, 50]) {
    const over = docs.filter((d) => d.size > mb * 1024 * 1024)
    console.log(`  over ${mb} MB: ${over.length} (${over.map((d) => d.accountKey).join(', ') || 'none'})`)
  }
  const dupes = docs.length - new Set(docs.map((d) => `${d.accountKey}:${d.sha256}`)).size
  console.log(`  byte-identical repeats within an account: ${dupes}`)
}
