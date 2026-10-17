/**
 * The formal greeting JWF uses in bursary letters: title and surname, never the
 * first name (Charlotte, 17 Oct 2026: "for official bursary communications, we
 * never use the parent's first name, it is JWF's style").
 *
 * Title comes as the stored code ("MRS") or label ("Mrs"). "Other" or no title
 * falls back to the full name rather than a bare surname. Pure.
 */
import { ADULT_TITLES, titleLabel } from "@/lib/contacts/titles";

export function formalGreeting(p: {
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const last = p.lastName?.trim() ?? "";
  const code = p.title?.trim().toUpperCase() ?? "";
  const title = code && code !== "OTHER" ? titleLabel(code, ADULT_TITLES) : "";
  if (title && last) return `${title} ${last}`;
  const full = [p.firstName?.trim(), last].filter(Boolean).join(" ");
  return full || "Parent";
}

/** Parent 1's contact block from a PARENT_DETAILS section's data, if present. */
export function parent1ContactOf(data: unknown): { title?: string; firstName?: string; lastName?: string } | null {
  if (!data || typeof data !== "object") return null;
  const c = (data as { parent1Contact?: unknown }).parent1Contact;
  if (!c || typeof c !== "object") return null;
  const { title, firstName, lastName } = c as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return { title: str(title), firstName: str(firstName), lastName: str(lastName) };
}
