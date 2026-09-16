# 04. Local Development

This guide sets up a computer to run the application locally, make changes to
it, and run the same checks that GitHub runs.

The application running on your computer connects to `supabase-nonprod`, the
Staging database. Anything created, changed or deleted locally is changed on
Staging. Emails sent locally are delivered to real recipients.

---

## 1. Install the tools

| Tool | Purpose | Install |
|---|---|---|
| Git | Downloads the code and records changes | [git-scm.com/downloads](https://git-scm.com/downloads) |
| nvm | Installs and switches between versions of Node.js | macOS and Linux: [nvm](https://github.com/nvm-sh/nvm#installing-and-updating). Windows: [nvm-windows](https://github.com/coreybutler/nvm-windows#installation--upgrades) |
| GitHub CLI (`gh`) | Signs Git in to GitHub and opens pull requests from the terminal | [cli.github.com](https://cli.github.com) |
| Vercel CLI (`vercel`) | Runs scheduled jobs on demand. Install after Node.js (section 4) with `npm install --global vercel` | [Vercel CLI](https://vercel.com/docs/cli) |
| Visual Studio Code | Code editor | [code.visualstudio.com](https://code.visualstudio.com) |

All commands in these guides are typed into a terminal: **Terminal** on macOS,
**PowerShell** on Windows.

---

## 2. Sign in to GitHub from the terminal

```
gh auth login
```

Choose **GitHub.com**, then **HTTPS**, then **Login with a web browser**, and
follow the prompts.

---

## 3. Download the code

```
git clone https://github.com/Meridian-Technology-Group/jwf-bursary-system.git
cd jwf-bursary-system
```

Every later command in these guides runs from inside the `jwf-bursary-system`
folder.

---

## 4. Install Node.js

The application requires Node.js version `22.12.0`, recorded in the `.nvmrc`
file.

```
nvm install
nvm use
node --version
```

The last command must print `v22.12.0`. Run `nvm use` again in every new
terminal window before working on the project.

---

## 5. Install the dependencies

```
npm ci
```

This installs the exact package versions recorded in `package-lock.json` and
generates the database client. It takes a few minutes.

---

## 6. Create the environment files

Create two files in the `jwf-bursary-system` folder, `.env.local` and `.env`,
with the contents given in
[03. Environment Variables](03-environment-variables.md), section 4. Fill in
each placeholder with the `supabase-nonprod` value.

Confirm both files point at Staging. Each must contain `lmkmgoqezgeeyjodbvzn`
and must not contain `tdnojrqkbccikfipthmk`.

---

## 7. Run the application

```
npm run dev
```

When the terminal shows `Ready`, open <http://localhost:3000>. Sign in with a
Staging staff account. Two factor authentication is not required locally.

Code changes appear in the browser automatically. Press `Ctrl` and `C` in the
terminal to stop the application.

---

## 8. Run the checks

GitHub runs these checks on every pull request. Run them locally before
pushing.

| Check | Command | Passes when |
|---|---|---|
| Type check | `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` | No output |
| Tests | `npm test` | Final summary shows no failed tests |
| Migration SQL | `npm run check:migrations` | No errors reported |
| Schema format | `npx prisma format --check` | No errors reported |

On Windows, run `Remove-Item tsconfig.tsbuildinfo -ErrorAction SilentlyContinue`
followed by `npx tsc --noEmit` for the type check.

Deleting `tsconfig.tsbuildinfo` first matters. The type checker caches its
previous results in that file and can otherwise report success while skipping
new files.

---

## 9. Scripts that must not be run

| Command | Why |
|---|---|
| `npm run seed:demo` | Deletes all applicants, applications, assessments and documents in the database it connects to, which is Staging. |
| `npx prisma migrate reset` | Deletes the entire database it connects to. |
| `npx prisma migrate dev` | Can offer to reset the database it connects to. |
| `npx prisma db push` | Changes the database structure without creating a migration. |

Database changes are made with migrations only. See
[06. Database Changes and Reference Data](06-database-changes-and-reference-data.md).

---

## 10. Keep the local copy up to date

Before starting new work:

```
git checkout staging
git pull
npm ci
```

Run `npm ci` again whenever `package-lock.json` has changed.
