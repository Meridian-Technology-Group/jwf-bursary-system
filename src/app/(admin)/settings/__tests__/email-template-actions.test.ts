import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const requireRoleMock = vi.fn(async () => ({
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Ad",
  lastName: "Min",
}));
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...(args as [])),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import {
  createEmailTemplateAction,
  deleteEmailTemplateAction,
  DEFAULT_CUSTOM_TEMPLATE_MERGE_FIELDS,
} from "../actions";

function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    emailTemplate: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "new-template-1",
        ...args.data,
      })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "custom-1",
        name: "Old Reminder",
        ...args.data,
      })),
    },
    ...overrides,
  };
}

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@example.test",
    firstName: "Ad",
    lastName: "Min",
  });
  fakeTx = makeFakeTx();
});

describe("createEmailTemplateAction", () => {
  it("rejects missing name/subject/body without touching the database", async () => {
    const res = await createEmailTemplateAction(fd({ name: "", subject: "Hi", body: "Body" }));
    expect(res.success).toBe(false);
    expect(fakeTx.emailTemplate.findFirst).not.toHaveBeenCalled();
    expect(fakeTx.emailTemplate.create).not.toHaveBeenCalled();
  });

  it("creates a custom template with isSystem false, type null, and the default merge fields, and audits", async () => {
    const res = await createEmailTemplateAction(
      fd({ name: "Round Opening Reminder", subject: "Subject", body: "Body text" })
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.id).toBe("new-template-1");
    }

    expect(fakeTx.emailTemplate.create).toHaveBeenCalledTimes(1);
    const createArg = (fakeTx.emailTemplate.create.mock.calls[0] as unknown[])[0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data).toMatchObject({
      name: "Round Opening Reminder",
      type: null,
      isSystem: false,
      subject: "Subject",
      body: "Body text",
      enabled: true,
      mergeFields: DEFAULT_CUSTOM_TEMPLATE_MERGE_FIELDS,
      createdBy: "admin-1",
    });

    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = (auditMock.mock.calls[0] as unknown[])[1] as { action: string };
    expect(auditArg.action).toBe("SETTINGS_EMAIL_TEMPLATE_CREATE");
  });

  it("rejects a duplicate name (case-insensitive) among active custom templates", async () => {
    fakeTx = makeFakeTx({
      emailTemplate: {
        findFirst: vi.fn(async () => ({ id: "existing-1", name: "Round Opening Reminder" })),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
    });

    const res = await createEmailTemplateAction(
      fd({ name: "round opening reminder", subject: "Subject", body: "Body" })
    );

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/already exists/i);
    }
    expect(fakeTx.emailTemplate.create).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-ADMIN caller is rejected before any DB write", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    const res = await createEmailTemplateAction(
      fd({ name: "X", subject: "Y", body: "Z" })
    );
    expect(res.success).toBe(false);
    expect(fakeTx.emailTemplate.create).not.toHaveBeenCalled();
  });
});

describe("deleteEmailTemplateAction", () => {
  it("rejects deleting a system template regardless of client input", async () => {
    fakeTx = makeFakeTx({
      emailTemplate: {
        findUnique: vi.fn(async () => ({
          id: "sys-1",
          isSystem: true,
          deletedAt: null,
          name: null,
        })),
        update: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    });

    const res = await deleteEmailTemplateAction(fd({ id: "sys-1" }));

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/system templates cannot be deleted/i);
    }
    expect(fakeTx.emailTemplate.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("soft-deletes a custom template (sets deletedAt) and audits", async () => {
    fakeTx = makeFakeTx({
      emailTemplate: {
        findUnique: vi.fn(async () => ({
          id: "custom-1",
          isSystem: false,
          deletedAt: null,
          name: "Round Opening Reminder",
        })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: "custom-1",
          name: "Round Opening Reminder",
          ...args.data,
        })),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    });

    const res = await deleteEmailTemplateAction(fd({ id: "custom-1" }));

    expect(res.success).toBe(true);
    expect(fakeTx.emailTemplate.update).toHaveBeenCalledTimes(1);
    const updateArg = (fakeTx.emailTemplate.update.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: { deletedAt: Date };
    };
    expect(updateArg.where).toEqual({ id: "custom-1" });
    expect(updateArg.data.deletedAt).toBeInstanceOf(Date);

    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = (auditMock.mock.calls[0] as unknown[])[1] as { action: string };
    expect(auditArg.action).toBe("SETTINGS_EMAIL_TEMPLATE_DELETE");
  });

  it("fails cleanly for a non-existent or already-deleted template", async () => {
    fakeTx = makeFakeTx({
      emailTemplate: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    });

    const res = await deleteEmailTemplateAction(fd({ id: "missing-1" }));
    expect(res.success).toBe(false);
    expect(fakeTx.emailTemplate.update).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-ADMIN caller is rejected before any DB write", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    const res = await deleteEmailTemplateAction(fd({ id: "custom-1" }));
    expect(res.success).toBe(false);
    expect(fakeTx.emailTemplate.update).not.toHaveBeenCalled();
  });
});
