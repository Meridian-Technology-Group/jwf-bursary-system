import { describe, expect, it } from 'vitest'
import {
  archivePathOf,
  declaredMimeFor,
  DOC_WINDOW,
  FALLBACK_SLOT,
  selectDocuments,
  slotFor,
  storageKey,
  type DocAccount,
  type GtDocRow,
} from '../docs/select'

const GRANT = 'BEC60C1C-CF51-4C9E-A88E-AB80011F64E8'
const row = (created: string, over: Partial<GtDocRow> = {}): GtDocRow => ({
  grantId: GRANT,
  docId: `d-${created}`,
  type: 'Progress Report Attachment',
  created,
  path: `DocumentsPath\\grants\\${GRANT.toLowerCase()}\\Statement ${created}.pdf`,
  ...over,
})
const account = (over: Partial<DocAccount> = {}): DocAccount => ({ key: 'k1', gt: { id: GRANT }, docsInWindow: 2, ...over })

describe('document selection (S26)', () => {
  const rows = [row('2025-11-04'), row('2025-11-05'), row('2026-07-31'), row('2026-08-01'), row('2026-01-01', { grantId: 'OTHER' })]

  it('takes the grant’s documents inside the window, both ends inclusive', () => {
    const { docs, countMismatches } = selectDocuments([account()], rows)
    expect(docs.map((d) => d.created)).toEqual([DOC_WINDOW[0], DOC_WINDOW[1]])
    expect(countMismatches).toEqual([])
  })

  it('honours a ruling that moves the window start', () => {
    const { docs } = selectDocuments([account({ docsWindow: ['2025-10-01', '2026-07-31'], docsInWindow: 3 })], rows)
    expect(docs).toHaveLength(3)
  })

  it('takes nothing for documents: NONE, excluded accounts or accounts with no GT grant', () => {
    expect(selectDocuments([account({ documents: 'NONE', docsInWindow: 0 })], rows).docs).toEqual([])
    expect(selectDocuments([account({ excluded: true })], rows).docs).toEqual([])
    expect(selectDocuments([account({ gt: null })], rows).docs).toEqual([])
  })

  it('reports an account whose count differs from what the canonical reviewed', () => {
    expect(selectDocuments([account({ docsInWindow: 5 })], rows).countMismatches).toEqual([{ key: 'k1', selected: 2, canonical: 5 }])
  })
})

describe('slots, types and paths', () => {
  it('maps GT document types to Grant Tracker slots, with a fallback', () => {
    expect(slotFor('Application Form Archived')).toBe('GRANT_TRACKER_APPLICATION_FORM')
    expect(slotFor('Progress Report Attachment')).toBe('GRANT_TRACKER_PROGRESS_REPORT_ATTACHMENT')
    expect(slotFor('General Attachment')).toBe(FALLBACK_SLOT)
    for (const s of [slotFor('Progress Report Attachment'), FALLBACK_SLOT]) expect(s).toMatch(/^[A-Z0-9_]{1,64}$/)
  })

  it('declares a type from the extension, case-insensitively', () => {
    expect(declaredMimeFor('Scan.JPG')).toBe('image/jpeg')
    expect(declaredMimeFor('letter.docx')).toMatch(/wordprocessingml/)
    expect(declaredMimeFor('no-extension')).toBe('application/octet-stream')
  })

  it('turns GT’s stored path into the archive entry name', () => {
    expect(archivePathOf('DocumentsPath\\grants\\abc\\x y.pdf')).toBe('DocumentStore/grants/abc/x y.pdf')
    expect(() => archivePathOf('x.pdf')).toThrow()
  })

  it('builds a deterministic, ASCII-safe key in the app’s layout', () => {
    const doc = { slot: 'GRANT_TRACKER_APPLICATION_ATTACHMENT', gtDocId: 'abc-123', filename: 'Relevé de compte (2) [final].pdf' }
    const key = storageKey('app-1', doc)
    expect(key).toBe('documents/app-1/GRANT_TRACKER_APPLICATION_ATTACHMENT/abc-123_Releve_de_compte_2_final_.pdf')
    expect(storageKey('app-1', doc)).toBe(key)
    expect(storageKey('app-1', { ...doc, filename: '..' })).toBe('documents/app-1/GRANT_TRACKER_APPLICATION_ATTACHMENT/abc-123_file')
  })
})
