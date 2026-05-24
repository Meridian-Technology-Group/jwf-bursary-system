// src/app/api/version/route.ts
//
// Build/version fingerprint endpoint (backlog #15).
//
// Returns non-sensitive build metadata so testers and automated checks can
// confirm *which build* a given URL is serving — important with production, a
// long-lived staging environment, and per-branch preview deployments all
// sharing the same UI.
//
// Intentionally UNAUTHENTICATED: the payload carries no secrets. The version
// comes from package.json (which release-please bumps — single source of truth),
// and the commit SHA / ref / environment are already exposed by Vercel via the
// deployment URL and uploaded source maps. Gating this to admins would only
// break the automated-check and preview-testing use cases without protecting
// anything sensitive. These values line up with the Sentry `release` (version)
// and `environment` (VERCEL_ENV) tags.

import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

const { version } = pkg;

// Captured once at module init. On Vercel this is build/cold-start time, which
// is effectively the deploy time for the running instance.
const startedAt = new Date().toISOString();

export const dynamic = "force-dynamic";

export function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return NextResponse.json(
    {
      version,
      commitSha,
      commitShaShort: commitSha ? commitSha.slice(0, 7) : null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      buildTime: startedAt,
    },
    {
      // Build metadata changes only on redeploy; allow brief edge caching but
      // keep it fresh enough for "is my fix live yet?" checks.
      headers: { "Cache-Control": "public, max-age=60" },
    }
  );
}
