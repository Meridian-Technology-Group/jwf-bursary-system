import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * 26 Nov 2026: `contribute/actions.ts` ("use server") exported a const array.
 * Next refuses to load such a module as a server action ("A 'use server' file
 * can only export async functions, found object"), so EVERY second-parent save
 * and submit 500'd. Unit tests import the module directly and never noticed.
 */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" || e.name === "node_modules" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('"use server" modules export only async functions (and types)', () => {
  const files = walk(path.resolve(__dirname, "../..")).filter((f) =>
    /^\s*["']use server["']/.test(fs.readFileSync(f, "utf8"))
  );

  it("finds the server-action modules", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [path.relative(process.cwd(), f), f]))("%s", (_name, file) => {
    const offending = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => /^export\s+(const|let|var|class|enum|default\s+(?!async))/.test(l));
    expect(offending).toEqual([]);
  });
});
