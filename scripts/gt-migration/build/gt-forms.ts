/**
 * Reads `gt_forms.tsv` (columns: ftype, eid, grid, row, control, rid, val)
 * for a given set of assessment entity ids. The file is ~790k lines; it is
 * streamed and only rows for the wanted entities are kept.
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { Controls } from './map-assessment'

export async function readGtForms(path: string, eids: ReadonlySet<string>): Promise<Map<string, Controls>> {
  const byEid = new Map<string, Map<string, string[]>>()
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) {
    const cols = line.split('\t')
    if (cols.length < 7) continue
    const eid = cols[1]
    if (!eids.has(eid)) continue
    const control = cols[4].trim()
    let controls = byEid.get(eid)
    if (!controls) {
      controls = new Map()
      byEid.set(eid, controls)
    }
    const values = controls.get(control)
    if (values) values.push(cols[6].trim())
    else controls.set(control, [cols[6].trim()])
  }
  return byEid
}
