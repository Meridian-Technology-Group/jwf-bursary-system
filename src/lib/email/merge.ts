// src/lib/email/merge.ts
// Merge field replacement for JWF email templates.
//
// Templates use {{field_name}} syntax (double curly braces) with optional
// whitespace around the field name, e.g. {{ field_name }} is also matched.

import type { EmailMergeData } from "./types";

/**
 * Regex that matches {{field_name}} placeholders.
 *
 * Capture group 1 is the trimmed field name.
 *
 * Rules:
 *  - Exactly two opening braces, optional whitespace, field name, optional
 *    whitespace, exactly two closing braces.
 *  - The field name must start with a letter or underscore and may contain
 *    letters, digits, underscores, and hyphens.
 *  - Nested braces (e.g. {{{field}}}) are intentionally NOT matched; the
 *    inner {{field}} will be matched while the outer extra brace is left as-is.
 *
 * The `g` flag ensures replaceAll semantics when used with String.replace().
 */
const MERGE_FIELD_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g;

/**
 * Replace all `{{field_name}}` placeholders in `template` with the
 * corresponding values from `data`.
 *
 * - Field names are matched case-sensitively.
 * - Whitespace around the field name inside the braces is ignored
 *   (e.g. `{{ field_name }}` resolves the same as `{{field_name}}`).
 * - If a placeholder has no matching key in `data`, it is left unchanged in
 *   the output so the caller can detect unreplaced fields.
 *
 * @param template - Source string containing zero or more {{field}} tokens.
 * @param data     - Map of field names to replacement values.
 * @returns        The template with all matched placeholders replaced.
 */
export function replaceMergeFields(
  template: string,
  data: EmailMergeData
): string {
  // Reset lastIndex so the stateful regex is always applied from the start.
  MERGE_FIELD_PATTERN.lastIndex = 0;

  return template.replace(MERGE_FIELD_PATTERN, (_match, fieldName: string) => {
    const trimmedKey = fieldName.trim();
    // Return original placeholder when no value is supplied.
    if (!(trimmedKey in data)) {
      return `{{${trimmedKey}}}`;
    }
    return data[trimmedKey];
  });
}
