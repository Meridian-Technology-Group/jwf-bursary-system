# Bursary Assessment System: Operations Guides

These guides describe how the John Whitgift Foundation Bursary Assessment
System works and how to operate it. They are written for a reader with no
previous experience of the services the system runs on.

Read guides 01 to 03 in order. Use the rest when the task or situation arises.

## Contents

| # | Guide | Use it to |
|---|---|---|
| 01 | [System Overview](01-system-overview.md) | Understand what the system is and the services it runs on |
| 02 | [Access and Accounts](02-access-and-accounts.md) | Get access to each service and sign in to the application |
| 03 | [Environment Variables](03-environment-variables.md) | Understand, set and rotate configuration and secrets |
| 04 | [Local Development](04-local-development.md) | Set up a computer to run and change the application |
| 05 | [Making and Releasing Changes](05-making-and-releasing-changes.md) | Move a change to Staging, then to Production |
| 06 | [Database Changes and Reference Data](06-database-changes-and-reference-data.md) | Run SQL queries, write migrations, and manage reference data |
| 07 | [Staff User Management](07-staff-user-management.md) | Create, change, reset and remove staff accounts |
| 08 | [Routine Health Checks](08-routine-health-checks.md) | Confirm weekly and monthly that Production is healthy |
| 09 | [Scheduled Jobs](09-scheduled-jobs.md) | Check the automatic jobs and manage data retention |
| 10 | [Email](10-email.md) | Understand email sending and trace an email that did not arrive |
| 11 | [Dependency and Security Updates](11-dependency-and-security-updates.md) | Keep the application's packages up to date and secure |
| 12 | [Rollback and Recovery](12-rollback-and-recovery.md) | Undo a bad release, take the site offline, restore data |
| 13 | [Troubleshooting](13-troubleshooting.md) | Diagnose and fix common problems |

## Conventions

| Convention | Meaning |
|---|---|
| **Production** | The live system used by the Foundation and applicants |
| **Staging** | The test copy of the system |
| **Bold text** | A label, button or menu item exactly as it appears on screen |
| **A, B, C** | Click or open A, then B, then C |
| `Monospace text` | A value, file name or command to type exactly |
| `<text in angle brackets>` | A placeholder: replace it, including the brackets, with the value described |

Using the application itself, as an administrator, assessor or applicant, is
covered by the User Guide in `docs/guides/`.
