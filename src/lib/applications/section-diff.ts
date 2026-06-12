/**
 * Section diff + assessor-edit provenance (CR-001 edit-on-behalf).
 *
 * When an ASSESSOR/ADMIN edits an application section on a parent's behalf we
 * record WHICH leaf fields they touched, so the UI can badge assessor-entered
 * values and the audit trail can name them. These helpers are pure:
 *
 *   - `diffSectionPaths` deep-diffs two section JSONB payloads and returns the
 *     leaf paths that were added, removed, or changed;
 *   - `mergeProvenance` stamps those paths with the editing assessor;
 *   - `clearProvenance` un-stamps them (the APPLICANT re-editing a field
 *     pre-submission reclaims ownership of it).
 *
 * Paths use dot notation with array elements by index ("children.0.fullName").
 * Section payloads are form-derived JSON, so keys never contain dots.
 */

/** Provenance for one leaf path: who last assessor-edited it, and when. */
export interface AssessorProvenanceEntry {
  editedBy: string;
  editedByName: string;
  editedAt: string;
}

/** Leaf path → provenance. Stored as JSONB alongside the section data. */
export type AssessorProvenanceMap = Record<string, AssessorProvenanceEntry>;

/**
 * Sentinel path for the non-object-root edge. Section payloads are always
 * objects in practice (Prisma `data Json @default("{}")`), but if either side
 * is a bare primitive we cannot produce field paths — so we compare the roots
 * directly and report a single "(root)" change when they differ.
 */
const ROOT_PATH = "(root)";

/** True for any non-null object or array — i.e. something we can recurse. */
function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

/**
 * Flattens a JSON payload to a map of leaf path → value. Leaves holding
 * null/undefined are SKIPPED so "missing", "null" and "undefined" all read as
 * the same "absent" state when the two sides are compared. Empty objects and
 * arrays contribute no leaves (a leaf-level diff has nothing to say about
 * them).
 */
function flattenLeaves(
  value: unknown,
  prefix: string,
  out: Map<string, unknown>
): void {
  if (value == null) return;
  if (isContainer(value)) {
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value);
    for (const [key, child] of entries) {
      flattenLeaves(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, value);
}

/**
 * Leaf-level deep diff between two section JSONB payloads. A path is returned
 * when a leaf was added, removed, or its value changed (strict equality).
 * null/undefined/missing are all treated as the same "absent" state, so e.g.
 * clearing a field to null reports the path once as "removed". Output is
 * lexicographically sorted for determinism.
 *
 * Non-object roots (see `ROOT_PATH`): if either side is a bare primitive the
 * roots are compared directly — `[]` when equivalent, `["(root)"]` otherwise.
 */
export function diffSectionPaths(oldData: unknown, newData: unknown): string[] {
  const oldPrimitive = oldData != null && !isContainer(oldData);
  const newPrimitive = newData != null && !isContainer(newData);
  if (oldPrimitive || newPrimitive) {
    return oldData === newData ? [] : [ROOT_PATH];
  }

  const oldLeaves = new Map<string, unknown>();
  const newLeaves = new Map<string, unknown>();
  flattenLeaves(oldData, "", oldLeaves);
  flattenLeaves(newData, "", newLeaves);

  const changed = new Set<string>();
  oldLeaves.forEach((oldValue, path) => {
    if (!newLeaves.has(path) || newLeaves.get(path) !== oldValue) {
      changed.add(path);
    }
  });
  newLeaves.forEach((_newValue, path) => {
    if (!oldLeaves.has(path)) changed.add(path);
  });
  return Array.from(changed).sort();
}

/** True when `value` is a well-formed `AssessorProvenanceEntry`. */
function isProvenanceEntry(value: unknown): value is AssessorProvenanceEntry {
  if (!isContainer(value) || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.editedBy === "string" &&
    typeof entry.editedByName === "string" &&
    typeof entry.editedAt === "string"
  );
}

/**
 * Parses a stored provenance payload defensively: anything that is not a plain
 * object becomes `{}`, and malformed entries are dropped (the JSONB column may
 * predate this code or have been hand-edited).
 */
function parseProvenance(existing: unknown): AssessorProvenanceMap {
  if (!isContainer(existing) || Array.isArray(existing)) return {};
  const parsed: AssessorProvenanceMap = {};
  for (const [path, entry] of Object.entries(existing)) {
    if (isProvenanceEntry(entry)) parsed[path] = entry;
  }
  return parsed;
}

/**
 * Stamps every `changedPath` with the editing assessor, preserving untouched
 * entries. Returns a NEW map; the input is never mutated.
 */
export function mergeProvenance(
  existing: unknown,
  changedPaths: string[],
  editor: { id: string; name: string; at: string }
): AssessorProvenanceMap {
  const merged = parseProvenance(existing);
  for (const path of changedPaths) {
    merged[path] = {
      editedBy: editor.id,
      editedByName: editor.name,
      editedAt: editor.at,
    };
  }
  return merged;
}

/**
 * Removes the `changedPaths` from the stored provenance — used when the
 * APPLICANT re-edits a field pre-submission and reclaims ownership of it.
 * Returns a NEW map; tolerates null/garbage `existing` (→ `{}`).
 */
export function clearProvenance(
  existing: unknown,
  changedPaths: string[]
): AssessorProvenanceMap {
  const cleared = parseProvenance(existing);
  for (const path of changedPaths) {
    delete cleared[path];
  }
  return cleared;
}
