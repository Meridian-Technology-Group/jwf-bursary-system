# 11. Dependency and Security Updates

The application is built from open source packages listed in `package.json`,
with exact versions recorded in `package-lock.json`. This guide covers checking
those packages for security problems and updating them.

Check monthly, and immediately when a security advisory is published for
Next.js, Supabase or Prisma.

---

## 1. Check for security problems

From the `jwf-bursary-system` folder, on an up to date `staging` branch (see
[04. Local Development](04-local-development.md), section 10):

```
npm audit --omit=dev
```

The command lists each known vulnerability in a package used by the running
application, with its severity: **low**, **moderate**, **high** or
**critical**.

- `found 0 vulnerabilities`: no action.
- Any **high** or **critical**: update the same week, following section 3.
- Only **low** or **moderate**: update at the next monthly check.

Also review the security advisories for the framework, which are published
before they reach `npm audit`:

- [Next.js security advisories](https://github.com/vercel/next.js/security/advisories)
- [Supabase JavaScript client releases](https://github.com/supabase/supabase-js/releases)
- [Prisma releases](https://github.com/prisma/prisma/releases)

Vendor documentation: [npm audit](https://docs.npmjs.com/cli/commands/npm-audit)

---

## 2. Version constraints

These packages are held on a fixed major version. Moving to a new major
version changes how the application is written, and is a development project,
not routine maintenance.

- `next` and `eslint-config-next` stay on **14.2**, updating only to newer 14.2
  releases.
- `react` and `react-dom` stay on **18**, updating only to newer 18 releases.
- `prisma` and `@prisma/client` stay on **6**, updating only to newer 6
  releases. The two packages must always have the same version as each other.
- Node.js stays on **22**, updating only to newer 22 releases.

---

## 3. Update packages

1. Create a branch:
   ```
   git checkout staging
   git pull
   git checkout -b chore/dependency-updates
   ```
2. Apply updates allowed by the version ranges in `package.json`:
   ```
   npm update
   npm audit fix
   ```
   Never run `npm audit fix --force`. It moves packages to new major versions.
3. To update Next.js to the latest 14.2 release:
   ```
   npm install next@14.2 eslint-config-next@14.2
   ```
4. Confirm the remaining audit result:
   ```
   npm audit --omit=dev
   ```
   A vulnerability that remains is fixed only in a new major version of a
   package. Record it and review it against section 2.
5. Run every check in [04. Local Development](04-local-development.md),
   section 8.
6. Run the application locally with `npm run dev`, and sign in.
7. Commit with the message `chore: update dependencies`, push, and merge into
   `staging` following [05. Making and Releasing Changes](05-making-and-releasing-changes.md).
   For a security fix use `sec: update dependencies`.

---

## 4. Test an update on Staging

After the update is live on Staging, confirm each of the following works:

- Sign in to the admin console as staff.
- Sign in to the applicant portal with a test applicant account.
- Upload a PDF on an application, then open it from the admin console.
- Open an application's assessment and save a change.
- Download a recommendation PDF.
- Download an export from **Exports**.
- Send an invitation to a test address you control, and confirm it arrives.

Then release to Production following
[05. Making and Releasing Changes](05-making-and-releasing-changes.md),
section 6.

---

## 5. Update Node.js

The Node.js version is set in four places, which must always match.

- `.nvmrc`: the full version, for example `22.12.0`.
- `.github/workflows/ci.yml`: the `node-version` setting.
- `.github/workflows/db-push.yml`: the `node-version` setting, in both jobs.
- The Vercel project, **Settings**, **Build and Deployment**, **Node.js
  Version**: the major version, for example `22.x`.

Change all four in one branch, run the checks, and release through Staging.

Vendor documentation: [Node.js releases](https://nodejs.org/en/about/previous-releases) ·
[Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
