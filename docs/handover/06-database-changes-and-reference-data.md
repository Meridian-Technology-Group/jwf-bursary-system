# 06. Database Changes and Reference Data

This guide covers reading data with SQL, changing the structure of the
database, recovering from a failed migration, and reference data.

---

## 1. Key terms

| Term | Meaning |
|---|---|
| **SQL** | The language used to read and change data in the database. |
| **Table** | A set of rows with the same columns, such as `applications` or `profiles`. |
| **Schema** | The structure of the database: its tables, columns and relationships. Described for this system in `prisma/schema.prisma`. |
| **Migration** | A file of SQL that changes the schema, such as adding a table or a column. Stored in `prisma/migrations/`, one folder per migration, applied in name order. |
| **Row Level Security (RLS)** | Rules attached to each table that decide which rows the application may read or change for the signed in user. Written as **policies**. |

---

## 2. Run a SQL query

1. Open <https://supabase.com/dashboard/projects> and click the project.
2. Check the project name at the top of the page. `supabase-prod` is live data.
3. In the left sidebar, click **SQL Editor**.
4. Click **New query**.
5. Paste the query into the editor.
6. Click **Run**, or press `Ctrl` and `Enter` (`Cmd` and `Enter` on macOS).
7. The results appear in the panel below the editor.

Queries that begin with `SELECT` only read data and are safe to run anywhere.
Any other query changes data. Run one against `supabase-prod` only when a
procedure in these guides gives it, and only with the placeholders replaced.

The SQL Editor runs as the database owner, which ignores Row Level Security.
It shows every row in every table.

Vendor documentation: [SQL Editor](https://supabase.com/docs/guides/database/overview#the-sql-editor)

### 2.1 Useful read only queries

Find a user account and its role:

```sql
SELECT id, email, role, first_name, last_name, created_at
FROM profiles
WHERE lower(email) = lower('<email address>');
```

Emails sent to an address, newest first:

```sql
SELECT created_at, template_type, subject, status, error, resend_id
FROM email_log
WHERE lower(to_email) = lower('<email address>')
ORDER BY created_at DESC;
```

Migrations applied to this database, newest first:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 10;
```

---

## 3. Rules for changing the database

1. **The database structure is changed only by migrations.** Never create, alter
   or drop tables in the SQL Editor.
2. **Migrations are applied by GitHub, never by hand.** A merge to `staging`
   applies them to `supabase-nonprod`. A merge to `main` applies them to
   `supabase-prod`.
3. **A migration that has been applied is never edited.** To correct it, write a
   new migration.
4. **Migrations only add.** A column or table the code stops using is removed
   in a later release, after the code that stopped using it is live in
   Production.
5. **A new table ships with its RLS policies in the same migration.** See
   section 4.3.

---

## 4. Write a migration

### 4.1 Change the schema

On a new branch (see [05. Making and Releasing Changes](05-making-and-releasing-changes.md)),
edit `prisma/schema.prisma` to describe the new structure.

Vendor documentation: [Prisma schema](https://www.prisma.io/docs/orm/prisma-schema/overview)

### 4.2 Generate the SQL

This compares the schema on `staging` with your edited schema and writes the
SQL needed to move from one to the other. It does not connect to any database.

```
git fetch origin
git show origin/staging:prisma/schema.prisma > previous.prisma
npx prisma migrate diff --from-schema-datamodel previous.prisma --to-schema-datamodel prisma/schema.prisma --script > migration.sql
```

Create the migration folder. Its name is the current date and time in UTC as
`YYYYMMDDHHMMSS`, an underscore, and a short description:

```
mkdir prisma/migrations/20261001120000_add_contact_notes
mv migration.sql prisma/migrations/20261001120000_add_contact_notes/migration.sql
rm previous.prisma
```

Open `migration.sql` and read it. It must contain only the changes you intended.

Vendor documentation: [prisma migrate diff](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-diff)

### 4.3 Add RLS policies for a new table

Every new table has Row Level Security switched on automatically when it is
created. A table with Row Level Security on and no policies does not raise an
error: it returns no rows to the application, and every feature that reads it
behaves as if the data is missing.

For every `CREATE TABLE` in the migration, add policies to the end of the same
`migration.sql`. Most tables fall into one of two patterns.

Reference data, readable by all staff and editable by administrators:

```sql
CREATE POLICY "<table>_select" ON "<table>"
  FOR SELECT TO app_user
  USING (is_admin_or_viewer() OR current_user_role() = 'ASSESSOR');

CREATE POLICY "<table>_modify" ON "<table>"
  FOR ALL TO app_user
  USING (is_admin())
  WITH CHECK (is_admin());
```

Data belonging to an applicant follows the policies of the table it belongs
to. Copy them from the migration that created that table, found by searching
`prisma/migrations/` for `ON "<parent table>"`.

### 4.4 Check and release

```
npx prisma validate
npx prisma format --check
npm run check:migrations
```

Commit the schema change, the migration folder and the code that uses it
together, then follow [05. Making and Releasing Changes](05-making-and-releasing-changes.md).

After the merge to `staging`, open GitHub, **Actions**, **DB push**, and
confirm the run has a green tick. The Staging job includes a step named **RLS
policy check**, which fails if any table has Row Level Security on and no
policies.

---

## 5. A migration failed to apply

**Symptom.** The **DB push** workflow shows a red cross on the **Prisma migrate
deploy** step. Every later migration is blocked on that database until this is
resolved.

1. Open the failed run, click the failed job, expand **Prisma migrate deploy**,
   and read the error. It names the migration and the SQL statement that
   failed.
2. In the SQL Editor of the affected project, run:
   ```sql
   SELECT migration_name, started_at, logs
   FROM _prisma_migrations
   WHERE finished_at IS NULL AND rolled_back_at IS NULL;
   ```
   This shows the failed migration.
3. Compare the migration's SQL with the database to find which statements ran
   before the failure. For example, a table created by the migration appears in
   **Table Editor** if its statement ran.
4. Undo the statements that ran, in reverse order, in the SQL Editor. For
   example, `DROP TABLE "<table created by the migration>";`.
5. Mark the migration as rolled back:
   ```sql
   UPDATE _prisma_migrations
   SET rolled_back_at = now()
   WHERE migration_name = '<failed migration name>'
     AND finished_at IS NULL;
   ```
6. Correct the SQL in the migration file on a new `fix/` branch, and release it
   through the normal path. The corrected migration applies in full on the next
   **DB push** run.

A failed migration was never applied, so correcting its file does not break
rule 3 in section 3.

Vendor documentation: [Failed migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing#failed-migration)

---

## 6. Reference data

Reference data is the configuration the assessment calculations depend on:
school fees, family type allowances, council tax defaults, reason codes, close
reasons and the calculation band tables.

| Task | How |
|---|---|
| Change a fee, allowance or reason code | Admin console, **Settings**. See the Admin and Assessor User Guide. |
| Add reference data needed by new code | Include `INSERT` statements for the rows in the same migration that creates or changes the table. |
| Populate a new, empty database | `npm run seed:reference`, described below. |

### 6.1 `npm run seed:reference`

Creates or updates every reference data row to match the values held in the
repository under `prisma/seed-data/` and `prisma/seed-reference.ts`, and creates
the `documents` storage bucket if it does not exist. It never deletes rows and
never touches applicants, applications or assessments.

**It overwrites values changed through Settings in the admin console.** Every
fee, allowance and reason code edited by an administrator returns to the value
in the repository. Run it only against a new, empty database.

The script connects to the database named in `.env.local`, and prints the
target project reference before writing. Stop it with `Ctrl` and `C` if the
reference printed is not the intended project.

### 6.2 `npm run seed:demo`

Deletes all profiles, applications, assessments and documents, then creates
demonstration data. Never run it. See
[04. Local Development](04-local-development.md), section 9.
