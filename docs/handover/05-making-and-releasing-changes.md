# 05. Making and Releasing Changes

This guide covers taking a code change from a local branch to Staging, and
from Staging to Production.

Complete [04. Local Development](04-local-development.md) first.

---

## 1. The path of a change

```
  your branch
      |  pull request, automated checks, squash and merge
      v
  staging  ------------>  Staging website updated
      |                   supabase-nonprod migrations applied
      |
      |  test on Staging
      |
      |  promotion pull request, merge commit
      v
  main     ------------>  Production website updated
                          supabase-prod migrations applied
```

Nothing is committed directly to `staging` or `main`. Every change enters
through a pull request.

---

## 2. Naming

### 2.1 Branches

| Prefix | Use for | Branch from |
|---|---|---|
| `feature/` | New functionality | `staging` |
| `fix/` | Bug fixes | `staging` |
| `chore/` | Dependency updates, configuration, tidying | `staging` |
| `hotfix/` | An urgent Production fix that cannot wait for Staging | `main` |

Follow the prefix with a short description in lower case words joined by
hyphens, for example `fix/reminder-email-date`.

### 2.2 Commit messages and pull request titles

Every commit message and pull request title starts with a type. The type
decides the next version number.

| Type | Use for | Effect on version |
|---|---|---|
| `feat:` | New functionality | Minor, for example 2.0.0 to 2.1.0 |
| `fix:` | Bug fix | Patch, for example 2.0.0 to 2.0.1 |
| `sec:` | Security fix | Patch |
| `perf:` | Performance improvement | Patch |
| `docs:` | Documentation only | None |
| `chore:` | Dependencies, configuration | None |
| `refactor:` | Code restructuring with no change in behaviour | None |
| `test:` | Tests only | None |

Example: `fix: show the correct deadline in reminder emails`.

---

## 3. Make a change

```
git checkout staging
git pull
git checkout -b fix/reminder-email-date
```

Make the change, then run the checks in
[04. Local Development](04-local-development.md), section 8.

```
git add .
git commit -m "fix: show the correct deadline in reminder emails"
git push -u origin fix/reminder-email-date
```

---

## 4. Merge the change into Staging

1. Open a pull request into `staging`:
   ```
   gh pr create --base staging --fill
   ```
   The command prints the pull request address.
2. Open the address. Wait for the **CI** check to show a green tick. A red
   cross means a check failed: click **Details** to read the failure, fix it on
   the same branch, commit and push again.
3. Click **Squash and merge**, then **Confirm squash and merge**.
4. Click **Delete branch**.

Merging starts two things:

- **The Staging deployment.** Vercel project, **Deployments**, top row for
  branch `staging`. Finished when its status is **Ready**.
- **The Staging database migrations.** GitHub repository, **Actions**, **DB
  push**, most recent run. Finished when it shows a green tick.

Confirm the new build is live: open
<https://jwf-bursary-system-git-staging-john-whitgift-foundation.vercel.app/api/version>
and check `commitShaShort` matches the first seven characters of the merge
commit shown on the pull request.

Vendor documentation:
[Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) ·
[Merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request)

---

## 5. Test on Staging

Test the change on the Staging website as the affected user would use it. Sign
in with Staging accounts only. Staging sends real emails, so use test email
addresses you control when inviting applicants or staff.

---

## 6. Release to Production

A release promotes everything currently on `staging` to `main`.

1. List what is being released:
   ```
   git fetch origin
   git log --oneline origin/main..origin/staging
   ```
2. Open the promotion pull request:
   ```
   gh pr create --base main --head staging --title "Promote staging to production"
   ```
   Paste the list from step 1 into the description.
3. Open the pull request and wait for the green tick on **CI**.
4. Open the merge button's drop down arrow, choose **Create a merge commit**,
   then click **Merge pull request** and **Confirm merge**. Never squash a
   promotion: squashing makes `main` and `staging` diverge.
5. Do not delete the `staging` branch.

Merging starts the Production deployment and the Production database
migrations. Watch both:

- **The Production deployment.** Vercel project, **Deployments**, top row
  marked **Production**. Finished when its status is **Ready**.
- **The Production database migrations.** GitHub repository, **Actions**, **DB
  push**, job **Push migrations to production**. Finished when it shows a green
  tick.

6. Open <https://jwf-bursary-system.vercel.app/api/version> and confirm
   `commitShaShort` matches the merge commit.
7. Sign in to Production and open one application to confirm the site works.

If the deployment fails or the site is broken, follow
[12. Rollback and Recovery](12-rollback-and-recovery.md).

### 6.1 The release pull request

After every merge to `main`, an automated pull request titled
`chore(main): release <version>` is opened or updated. It contains the new
version number and the `CHANGELOG.md` entries generated from commit messages.

Merge it with **Squash and merge** after each release. This records the version
number and creates a tagged release on GitHub. Its merge triggers one further
Production deployment containing only the version change.

The version shown by Staging at `/api/version` is lower than Production's
until the next promotion. This is expected.

---

## 7. Hotfix

Use only when Production is broken and the fix cannot wait for the normal path.

1. Create the branch from `main`:
   ```
   git checkout main
   git pull
   git checkout -b hotfix/<short-description>
   ```
2. Make the fix, run the checks, commit with a `fix:` message, and push.
3. Open a pull request into `main`:
   ```
   gh pr create --base main --fill
   ```
4. Wait for **CI**, then **Squash and merge**.
5. Confirm the Production deployment and `/api/version` as in section 6.
6. Bring the fix back into `staging` so the next promotion does not undo it:
   ```
   git checkout staging
   git pull
   git checkout -b chore/backport-<short-description>
   git merge origin/main
   git push -u origin chore/backport-<short-description>
   gh pr create --base staging --fill
   ```
7. Wait for **CI**, then merge with **Create a merge commit**.
