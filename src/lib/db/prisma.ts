import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Prisma client — JWF Bursary System.
 *
 * Runtime connection runs as the non-superuser Postgres role `app_user`
 * (created in migration 20260513090020_enable_row_level_security). That role
 * is subject to Row Level Security on every personal-data table.
 *
 * To make RLS effective, every request that performs queries against
 * personal-data tables MUST be wrapped in `withUserContext()` (or, for
 * genuine admin operations such as the GDPR cascade or invitation creation,
 * `withAdminContext()`).
 *
 * The wrappers open a transaction and run
 *   SET LOCAL request.jwt.claims = '{ "sub": "<uuid>", "role": "<role>" }'
 * so that the policy helpers (`public.current_user_id()`,
 * `public.current_user_role()`) return the correct values for the duration
 * of the transaction. `SET LOCAL` means the claim is automatically discarded
 * when the transaction commits or rolls back — connection pool reuse is
 * safe.
 *
 * See also: docs/security-audit.md §2.2.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── RLS context helpers ─────────────────────────────────────────────────────

/**
 * A Prisma transaction client. Aliased so callers don't need to import the
 * `Prisma` namespace just to type their callbacks.
 */
export type Tx = Prisma.TransactionClient;

/**
 * Application role values that may be set as the JWT `role` claim.
 * `service_role` is reserved for {@link withAdminContext}.
 */
export type RlsRole =
  | "APPLICANT"
  | "ADMIN"
  | "ASSESSOR"
  | "VIEWER"
  | "DELETED"
  | "service_role";

/**
 * Run `fn` inside a transaction that has the given user id and role attached
 * as `request.jwt.claims`. All queries inside `fn` will be filtered by RLS.
 *
 * Usage:
 * ```ts
 * const sections = await withUserContext(user.id, user.role, (tx) =>
 *   tx.applicationSection.findMany({ where: { applicationId } })
 * );
 * ```
 */
export async function withUserContext<T>(
  userId: string,
  role: RlsRole,
  fn: (tx: Tx) => Promise<T>,
  options?: { timeoutMs?: number; maxWaitMs?: number },
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // SET LOCAL must use a literal — the JSON is constructed via
      // jsonb_build_object so values are parameterised by Postgres.
      await tx.$executeRaw`
        SELECT set_config(
          'request.jwt.claims',
          jsonb_build_object('sub', ${userId}::text, 'role', ${role}::text)::text,
          true
        )
      `;
      return fn(tx);
    },
    {
      timeout: options?.timeoutMs ?? 10_000,
      maxWait: options?.maxWaitMs ?? 5_000,
    },
  );
}

/**
 * Run `fn` with the `service_role` claim, which the RLS policies treat as a
 * bypass. Use ONLY for genuine admin operations that the audit identifies as
 * needing service-role privilege:
 *   - Invitation creation
 *   - Profile creation during registration
 *   - GDPR delete cascade
 *   - Reference-data writes by ADMIN
 *
 * The caller is responsible for performing application-level authorisation
 * before invoking this helper.
 */
export async function withAdminContext<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: { timeoutMs?: number; maxWaitMs?: number },
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT set_config(
          'request.jwt.claims',
          jsonb_build_object('role', 'service_role'::text)::text,
          true
        )
      `;
      return fn(tx);
    },
    {
      timeout: options?.timeoutMs ?? 30_000,
      maxWait: options?.maxWaitMs ?? 5_000,
    },
  );
}
