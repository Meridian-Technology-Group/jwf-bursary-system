/**
 * Which Grant Tracker documents each migrated account takes (M8 step 1,
 * decision S26; 02-target-model.md §9).
 *
 * GT hangs documents off the grant, not off a cycle, so the cycle is taken by
 * date: everything created inside the account's window. The window is S26's
 * (5 Nov 2025 – 31 Jul 2026) unless a ruling moved its start (`docsWindow`);
 * `documents: "NONE"` takes nothing. The count per account must equal the
 * canonical's own `docsInWindow`, or the selection has drifted from what she
 * reviewed.
 *
 * Pure: no database, no archive. Paths and filenames stay inside the result
 * and are never logged; logs carry account keys and counts only.
 */
import { readFileSync } from 'node:fs'

export const DOC_WINDOW: readonly [string, string] = ['2025-11-05', '2026-07-31']

/**
 * GT document type → upload slot. Slots are free strings (`^[A-Z0-9_]{1,64}$`);
 * these humanise in the documents tab as "Grant Tracker Progress Report" etc.
 * (02 §9 named them `GT_*`, which reads as "Gt …" there.)
 */
export const SLOT_BY_GT_TYPE: Readonly<Record<string, string>> = {
  'Application Form': 'GRANT_TRACKER_APPLICATION_FORM',
  'Application Form Archived': 'GRANT_TRACKER_APPLICATION_FORM',
  'Application Attachment': 'GRANT_TRACKER_APPLICATION_ATTACHMENT',
  'Progress Report': 'GRANT_TRACKER_PROGRESS_REPORT',
  'Progress Report Review Form': 'GRANT_TRACKER_PROGRESS_REPORT',
  'Progress Report Attachment': 'GRANT_TRACKER_PROGRESS_REPORT_ATTACHMENT',
}
export const FALLBACK_SLOT = 'GRANT_TRACKER_ATTACHMENT'

/** Declared type by extension; the extracted bytes are sniffed and win for PDF/JPEG/PNG. */
const MIME_BY_EXT: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  heic: 'image/heic',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  eml: 'message/rfc822',
}

export interface DocAccount {
  key: string
  gt?: { id: string } | null
  excluded?: unknown
  documents?: string | null
  docsWindow?: [string, string] | null
  docsInWindow?: number | null
}

export interface GtDocRow {
  grantId: string
  docId: string
  type: string
  created: string
  /** As GT stores it: `DocumentsPath\grants\<grant>\<file>`. */
  path: string
}

export interface SelectedDoc {
  accountKey: string
  gtDocId: string
  gtType: string
  created: string
  slot: string
  filename: string
  declaredMime: string
  /** Entry name inside DocumentStore.zip. */
  archivePath: string
}

export function readGrantDocs(file: string): GtDocRow[] {
  const rows: GtDocRow[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const p = line.replace(/\r$/, '').split('\t')
    if (p.length < 7 || !p[0]) continue
    rows.push({ grantId: p[0].toUpperCase(), docId: p[1].toLowerCase(), type: p[2], created: p[5].slice(0, 10), path: p[6] })
  }
  return rows
}

export function slotFor(gtType: string): string {
  return SLOT_BY_GT_TYPE[gtType] ?? FALLBACK_SLOT
}

export function declaredMimeFor(filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/** `DocumentsPath\grants\abc\x.pdf` → `DocumentStore/grants/abc/x.pdf`. */
export function archivePathOf(gtPath: string): string {
  const rest = gtPath.split('\\').slice(1).join('/')
  if (!rest) throw new Error('GT document path has no folder')
  return `DocumentStore/${rest}`
}

export function windowFor(a: DocAccount): readonly [string, string] {
  return a.docsWindow ?? DOC_WINDOW
}

export interface Selection {
  docs: SelectedDoc[]
  /** Accounts whose selected count differs from the canonical's `docsInWindow`. */
  countMismatches: { key: string; selected: number; canonical: number }[]
}

export function selectDocuments(accounts: readonly DocAccount[], rows: readonly GtDocRow[]): Selection {
  const byGrant = new Map<string, GtDocRow[]>()
  for (const r of rows) byGrant.set(r.grantId, [...(byGrant.get(r.grantId) ?? []), r])

  const docs: SelectedDoc[] = []
  const countMismatches: Selection['countMismatches'] = []
  for (const a of accounts) {
    if (a.excluded || !a.gt?.id) continue
    const [from, to] = windowFor(a)
    const picked =
      a.documents === 'NONE'
        ? []
        : (byGrant.get(a.gt.id.toUpperCase()) ?? []).filter((r) => from <= r.created && r.created <= to)
    for (const r of picked) {
      const archivePath = archivePathOf(r.path)
      const filename = archivePath.split('/').pop()!
      docs.push({
        accountKey: a.key,
        gtDocId: r.docId,
        gtType: r.type,
        created: r.created,
        slot: slotFor(r.type),
        filename,
        declaredMime: declaredMimeFor(filename),
        archivePath,
      })
    }
    const canonical = a.docsInWindow ?? 0
    if (picked.length !== canonical) countMismatches.push({ key: a.key, selected: picked.length, canonical })
  }
  return { docs, countMismatches }
}

/**
 * The object key: `documents/{applicationId}/{slot}/{gtDocId}_{safeFilename}`,
 * the app's `buildStoragePath` layout with GT's document id in place of the
 * random uuid, so a re-run lands on the same key. Storage keys are restricted
 * to a safe ASCII set; the original name stays in `documents.filename`.
 */
export function storageKey(applicationId: string, doc: Pick<SelectedDoc, 'slot' | 'gtDocId' | 'filename'>): string {
  const safe = doc.filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-120)
  return `documents/${applicationId}/${doc.slot}/${doc.gtDocId}_${safe || 'file'}`
}
