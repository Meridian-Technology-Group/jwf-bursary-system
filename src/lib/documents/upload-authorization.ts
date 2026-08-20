/**
 * Contributor-aware authorisation for applicant document uploads.
 *
 * Extracted from `POST /api/documents` (A1) so the presigned flow's two legs —
 * `/api/documents/sign` and `/api/documents/confirm` — enforce byte-identical
 * rules. Splitting one request into three must not create two subtly different
 * authorisation paths; there is exactly one implementation and both legs call
 * it.
 *
 * The rules (dual-parent, PR 4b) are unchanged from the multipart route:
 *   - The lead applicant (PRIMARY contributor) uploads to the legacy
 *     `documents/{appId}/{slot}/...` namespace; the document is tagged with
 *     their PRIMARY contributor id.
 *   - A SECONDARY contributor uploads to `documents/{appId}/secondary/{slot}/...`
 *     and the document is tagged with their SECONDARY contributor id, so the
 *     route handlers (the enforcing layer) can later isolate it from the
 *     primary.
 *   - The role is RESOLVED SERVER-SIDE from the session — never trusted from
 *     the request — and an applicant who is neither contributor is rejected.
 */

import { ApplicationContributorRole } from "@prisma/client";
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { ensurePrimaryContributor } from "@/lib/db/queries/contributors";
import { getLatestMissingDocsRequest } from "@/lib/db/queries/missing-docs";
import type { UploadNamespace } from "@/lib/uploads/upload-ticket";

/** The sub-directory a SECONDARY contributor's uploads live under. */
export const SECONDARY_NAMESPACE = "secondary";

export interface UploadAuthorizationGrant {
  ok: true;
  /** Owning contributor id for the Document row (`uploadedByContributorId`). */
  contributorId: string | null;
  /** Which storage namespace this caller may write to. */
  namespace: UploadNamespace;
  /** `undefined` for PRIMARY — the legacy path has no sub-namespace segment. */
  subNamespace: string | undefined;
}

export interface UploadAuthorizationDenial {
  ok: false;
  status: 403 | 404 | 409;
  error: string;
}

export type UploadAuthorization =
  | UploadAuthorizationGrant
  | UploadAuthorizationDenial;

/**
 * Epic 15 P1 (CI-07/08): while a missing-documents request is open (the
 * assessment is PAUSED), the parent may upload into the REQUESTED slots of
 * their submitted application — and nothing else. The window shuts by itself
 * when `submitMissingDocsResponse` resumes the assessment (PAUSED →
 * IN_PROGRESS), so the exemption below evaporates and the blanket
 * submitted-application 409 applies again. That IS the one-shot window.
 *
 * The admin-context reads are safe here: the caller's visibility of the
 * application was already proven under RLS user context, and the exemption is
 * keyed purely on the application's own paused state + requested slots (the
 * same pattern as the portal /respond page).
 */
async function isOpenMissingDocsSlot(
  applicationId: string,
  slot: string | undefined
): Promise<{ paused: boolean; slotAllowed: boolean }> {
  const assessment = await withAdminContext((tx) =>
    tx.assessment.findUnique({
      where: { applicationId },
      select: { status: true },
    })
  );
  if (assessment?.status !== "PAUSED") {
    return { paused: false, slotAllowed: false };
  }
  if (!slot) return { paused: true, slotAllowed: false };
  const request = await getLatestMissingDocsRequest(applicationId);
  return {
    paused: true,
    slotAllowed: Boolean(request?.requestedSlots.includes(slot)),
  };
}

/**
 * Resolves whether `user` may upload a document to `applicationId`, and under
 * which contributor identity / storage namespace.
 *
 * @param user          The authenticated caller (from `getCurrentUser`).
 * @param applicationId The target application.
 * @param slot          The target document slot — used only for the paused
 *                      missing-docs window exemption (CI-07/08); uploads to a
 *                      submitted application are refused without it.
 */
export async function authorizeDocumentUpload(
  user: { id: string; role: string },
  applicationId: string,
  slot?: string
): Promise<UploadAuthorization> {
  // The application is fetched (status guard + existence). This is the
  // enforcing layer — the storage RLS namespace is only a backstop.
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true, leadApplicantId: true, formStatus: true },
      })
  );

  if (!application) {
    return { ok: false, status: 404, error: "Application not found" };
  }

  // PR-6a: the submission guard reads form_status, not the deprecated fused
  // applications.status. Epic 15 P1 (CI-07/08): a PAUSED missing-docs window
  // exempts exactly the requested slots — nothing else on a submitted
  // application is ever parent-writable.
  if (application.formStatus === "SUBMITTED") {
    const window = await isOpenMissingDocsSlot(applicationId, slot);
    if (!window.slotAllowed) {
      return {
        ok: false,
        status: 409,
        error: window.paused
          ? "Only the documents requested by the Bursary Office can be uploaded while your application is paused"
          : "Cannot upload documents to a submitted application",
      };
    }
  }

  const isLeadApplicant = application.leadApplicantId === user.id;

  // Resolve which contributor the caller owns (PRIMARY for the lead applicant;
  // SECONDARY for the second parent). Under RLS the caller may SELECT their own
  // contributor row.
  const contributor = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.applicationContributor.findUnique({
        where: {
          applicationId_profileId: { applicationId, profileId: user.id },
        },
        select: { id: true, role: true },
      })
  );

  const isSecondary =
    contributor?.role === ApplicationContributorRole.SECONDARY;

  if (!isLeadApplicant && !isSecondary) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Determine the owning contributor id + storage namespace. The contributor
  // row resolved above (keyed on applicationId+profileId) IS the caller's own
  // row — their PRIMARY row for the lead applicant, their SECONDARY row for the
  // second parent.
  let contributorId: string | null = contributor?.id ?? null;
  if (isLeadApplicant && !contributorId) {
    // Self-heal the (should-be-impossible) missing PRIMARY contributor under
    // admin context — the applicant cannot upsert the contributor row by policy.
    contributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, applicationId, user.id)
    );
  }

  return {
    ok: true,
    contributorId,
    namespace: isSecondary ? "secondary" : "primary",
    subNamespace: isSecondary ? SECONDARY_NAMESPACE : undefined,
  };
}
