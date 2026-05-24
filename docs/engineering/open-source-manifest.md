# Open-Source Manifest

A record of the third-party open-source software that ships in the John Whitgift
Foundation Bursary System, with each package's version, SPDX licence and source
link, so the Foundation has a clear account of what runs in production. (MSA
clause 12.2 deliverable.)

- **Generated:** 2026-05-23
- **Scope:** production dependency tree only (runtime). Dev/test/build-only
  tooling — TypeScript, ESLint, Vitest, PostCSS, `tsx`, `dotenv` and their
  transitive trees — is **excluded**, as it is not distributed at runtime.
- **Method:** `npx license-checker --production --json` run against the
  installed `node_modules`, which resolves the full transitive production tree.
- **Result:** **412** production packages. **All effectively permissive**
  (MIT / ISC / BSD / Apache-2.0 / Unlicense / 0BSD / MIT-0 / CC-BY-4.0 data).
  No copyleft obligations apply to the distributed software. Four entries are
  noted for record-keeping in the review section below; none requires action.

---

## Regenerating this manifest

Run from the repository root with dependencies installed (`npm ci`):

```bash
# Full transitive production tree, machine-readable:
npx license-checker --production --json > licenses.json

# Or a quick human-readable summary grouped by licence:
npx license-checker --production --summary
```

Refresh the manifest at each release: re-run the command, update the table and
the generated date, and re-check the review section for any new non-permissive
licence. (`license-checker` reads the `license` field from each installed
package; if `node_modules` is absent, run `npm ci` first.)

---

## Licence distribution (full production tree, 412 packages)

| Count | Licence |
|---:|---|
| 343 | MIT |
| 33 | ISC |
| 18 | Apache-2.0 |
| 5 | BSD-3-Clause |
| 2 | Unlicense |
| 2 | MIT* (declared MIT; detected from package text) |
| 1 | BSD-2-Clause |
| 1 | 0BSD |
| 1 | MIT-0 |
| 1 | MIT AND ISC |
| 1 | (MIT AND Zlib) |
| 1 | (MIT OR GPL-3.0-or-later) — see review |
| 1 | CC-BY-4.0 (data only) — see review |
| 1 | Custom — see review |
| 1 | UNLICENSED — this project itself; see review |

All licences above are in, or compatible with, the permissive set
(MIT / ISC / BSD / Apache-2.0 / Unlicense). The dual-licensed package may be
used under its MIT option.

---

## Direct production dependencies

These are the packages declared in `package.json` `dependencies` — the ones the
application code imports directly. Versions are the resolved installed versions
from the lockfile.

| Package | Version | SPDX Licence | Source |
|---|---|---|---|
| `next` | 14.2.35 | MIT | https://github.com/vercel/next.js |
| `react` | 18.3.1 | MIT | https://github.com/facebook/react |
| `react-dom` | 18.3.1 | MIT | https://github.com/facebook/react |
| `@prisma/client` | 6.19.2 | Apache-2.0 | https://github.com/prisma/prisma |
| `prisma` | 6.19.2 | Apache-2.0 | https://github.com/prisma/prisma |
| `@supabase/ssr` | 0.8.0 | MIT | https://github.com/supabase/ssr |
| `@supabase/supabase-js` | 2.98.0 | MIT | https://github.com/supabase/supabase-js |
| `resend` | 6.9.3 | MIT | https://github.com/resend/resend-node |
| `svix` | 1.84.1 | MIT | https://github.com/svix/svix-webhooks |
| `@upstash/ratelimit` | 2.0.8 | MIT | https://github.com/upstash/ratelimit-js |
| `@vercel/kv` | 3.0.0 | Apache-2.0 | https://github.com/vercel/storage |
| `zod` | 4.3.6 | MIT | https://github.com/colinhacks/zod |
| `react-hook-form` | 7.71.2 | MIT | https://github.com/react-hook-form/react-hook-form |
| `@hookform/resolvers` | 5.2.2 | MIT | https://github.com/react-hook-form/resolvers |
| `@tanstack/react-table` | 8.21.3 | MIT | https://github.com/TanStack/table |
| `@react-pdf/renderer` | 4.3.2 | MIT | https://github.com/diegomura/react-pdf |
| `exceljs` | 4.4.0 | MIT | https://github.com/exceljs/exceljs |
| `recharts` | 3.7.0 | MIT | https://github.com/recharts/recharts |
| `date-fns` | 4.1.0 | MIT | https://github.com/date-fns/date-fns |
| `lucide-react` | 0.575.0 | ISC | https://github.com/lucide-icons/lucide |
| `cmdk` | 1.1.1 | MIT | https://github.com/pacocoursey/cmdk |
| `sonner` | 2.0.7 | MIT | https://github.com/emilkowalski/sonner |
| `react-day-picker` | 9.14.0 | MIT | https://github.com/gpbl/react-day-picker |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | https://github.com/joe-bell/cva |
| `clsx` | 2.1.1 | MIT | https://github.com/lukeed/clsx |
| `tailwind-merge` | 3.5.0 | MIT | https://github.com/dcastil/tailwind-merge |
| `tailwindcss-animate` | 1.0.7 | MIT | (npm package; no public repo declared) |
| `@tailwindcss/forms` | 0.5.11 | MIT | https://github.com/tailwindlabs/tailwindcss-forms |

### Radix UI primitives (shadcn/ui foundation)

The `ui/` component layer is built on Radix primitives. All are MIT-licensed and
published from the same monorepo (https://github.com/radix-ui/primitives).
Declared in `package.json`:

| Package | Version | SPDX Licence |
|---|---|---|
| `@radix-ui/react-avatar` | 1.1.11 | MIT |
| `@radix-ui/react-checkbox` | 1.3.3 | MIT |
| `@radix-ui/react-dialog` | 1.1.15 | MIT |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | MIT |
| `@radix-ui/react-label` | 2.1.8 | MIT |
| `@radix-ui/react-popover` | 1.1.15 | MIT |
| `@radix-ui/react-radio-group` | 1.3.8 | MIT |
| `@radix-ui/react-scroll-area` | 1.2.10 | MIT |
| `@radix-ui/react-select` | 2.2.6 | MIT |
| `@radix-ui/react-separator` | 1.1.8 | MIT |
| `@radix-ui/react-slot` | 1.2.4 | MIT |
| `@radix-ui/react-switch` | 1.2.6 | MIT |
| `@radix-ui/react-tabs` | 1.1.13 | MIT |
| `@radix-ui/react-toast` | 1.2.15 | MIT |
| `@radix-ui/react-tooltip` | 1.2.8 | MIT |

A further ~30 `@radix-ui/*` packages are pulled in transitively (e.g.
`react-popper`, `react-primitive`, `react-portal`); all are MIT.

---

## Major user-facing components

The headline frameworks and libraries the system is built on, and their
licences (as installed):

| Component | Role | Licence |
|---|---|---|
| Next.js | Web framework / server runtime | MIT |
| React / React DOM | UI runtime | MIT |
| Prisma (`prisma`, `@prisma/client`) | ORM / database access | Apache-2.0 |
| `@supabase/*` | Auth, database client, storage | MIT |
| Tailwind CSS¹ + shadcn/ui (Radix) | Styling and UI primitives | MIT |
| `@react-pdf/renderer` | Recommendation PDF generation | MIT |
| ExcelJS | XLSX / CSV exports | MIT |
| Recharts | Reporting charts | MIT |
| Resend SDK | Transactional email | MIT |

¹ Tailwind CSS itself (`tailwindcss`) is a build-time dev dependency (MIT) and so
sits outside the production tree; its runtime helpers (`@tailwindcss/forms`,
`tailwind-merge`, `tailwindcss-animate`) are listed above and are all MIT.

---

## Licence review — non-permissive / flagged entries

Reviewed the full 412-package production tree against the permissive set
(MIT / ISC / BSD / Apache-2.0 / Unlicense / 0BSD / MIT-0). **No copyleft
(GPL / AGPL / LGPL / MPL / SSPL) obligations bind the distributed software.**
Four entries were surfaced by the scan for record only:

| Package | Version | Reported licence | Assessment |
|---|---|---|---|
| `jszip` | 3.10.1 | `(MIT OR GPL-3.0-or-later)` | **Dual-licensed.** We use it under the **MIT** option, so no GPL obligation applies. Pulled in transitively by ExcelJS. No action. |
| `caniuse-lite` | 1.0.30001774 | `CC-BY-4.0` | A **browser-support dataset** (not code) used at build time by Browserslist; the CC-BY-4.0 licence covers data, requires only attribution, and imposes no copyleft on our code. No action. |
| `buffers` | 0.1.1 | `Custom` (points to the project repo) | Legacy transitive dependency. Its source repository carries an MIT licence; the registry metadata simply lacks a normalised SPDX field. Permissive in practice. No action. |
| `jwf-bursary-system` | 0.1.0 | `UNLICENSED` | **This project itself** — `"private": true` in `package.json`. `UNLICENSED` correctly signals it is proprietary and not for redistribution. Expected; not a third-party item. |

**Conclusion:** the production dependency tree is entirely permissive. No
GPL/AGPL/LGPL/MPL/SSPL-licensed code is distributed, and no licence in the tree
imposes share-alike or source-disclosure obligations on the Foundation's system.
