/**
 * In-memory stand-in for one Supabase Storage bucket's `list` — per folder,
 * folders reported with a null id, sorted by name, paged by limit/offset —
 * for the orphaned-upload tests. It has no `remove`: nothing here can delete.
 */
import type { StorageLister } from "../orphan-uploads";

export interface FakeObject {
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export function fakeBucket(objects: readonly FakeObject[], hooks: { onList?: (folder: string) => void; failFolders?: string[] } = {}) {
  const calls: { folder: string; offset: number; limit: number }[] = [];
  const lister: StorageLister = {
    async list(folder, { limit, offset }) {
      calls.push({ folder, offset, limit });
      hooks.onList?.(folder);
      if (hooks.failFolders?.includes(folder)) return { data: null, error: { message: "boom" } };
      const prefix = folder ? `${folder}/` : "";
      const entries = new Map<string, { name: string; id: string | null; created_at?: string; updated_at?: string }>();
      for (const o of objects) {
        if (!o.name.startsWith(prefix)) continue;
        const rest = o.name.slice(prefix.length);
        const slash = rest.indexOf("/");
        if (slash === -1) {
          entries.set(rest, { name: rest, id: `id:${o.name}`, created_at: o.createdAt, updated_at: o.updatedAt ?? o.createdAt });
        } else {
          const dir = rest.slice(0, slash);
          if (!entries.has(dir)) entries.set(dir, { name: dir, id: null });
        }
      }
      const sorted = Array.from(entries.values()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return { data: sorted.slice(offset, offset + limit), error: null };
    },
  };
  return { lister, calls };
}

export const APP_A = "11111111-1111-4111-8111-111111111111";
export const APP_B = "22222222-2222-4222-8222-222222222222";
