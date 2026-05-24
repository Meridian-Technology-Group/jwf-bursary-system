// src/lib/build-info.ts
//
// Single source of truth for the in-app build fingerprint (backlog #15).
//
// `version` is imported from package.json — the same value release-please bumps
// and the same value wired into the Sentry `release` tag. The commit SHA / env
// are read from the NEXT_PUBLIC_* vars Vercel auto-populates at build time
// (no new secret required), so this module is safe to import from client
// components: the values are inlined into the bundle as plain build metadata.

import pkg from "../../package.json";

const { version } = pkg;

export interface BuildInfo {
  version: string;
  commitShaShort: string | null;
  env: string;
}

export function getBuildInfo(): BuildInfo {
  const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null;
  return {
    version,
    commitShaShort: sha ? sha.slice(0, 7) : null,
    env: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  };
}

/** Compact one-line label, e.g. "v1.0.0 · preview · a1b2c3d". */
export function formatBuildLabel(info: BuildInfo = getBuildInfo()): string {
  const parts = [`v${info.version}`];
  if (info.env && info.env !== "production") parts.push(info.env);
  if (info.commitShaShort) parts.push(info.commitShaShort);
  return parts.join(" · ");
}
