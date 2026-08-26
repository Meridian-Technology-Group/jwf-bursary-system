/**
 * Contact register page (Epic 04).
 *
 * Server component — ADMIN only. The lead-applicant contact register is the
 * primary "invite a family" entry point: an administrator curates families
 * here (parent + child + locked school + entry year + address) and invites
 * them from a contact (PR-3).
 */

export const dynamic = "force-dynamic";

import { Users } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { listContacts } from "@/lib/db/queries/contacts";
import { listRounds } from "@/lib/db/queries/rounds";
import { ContactsTable } from "@/components/admin/contacts/contacts-table";
import { inviteBccAddress } from "@/lib/email/send";

export const metadata = {
  title: "Contacts",
};

export default async function ContactsPage() {
  const user = await requireRole([Role.ADMIN]);

  const [contacts, rounds] = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => Promise.all([listContacts(tx), listRounds(tx)])
  );

  // Invite into LIVE rounds only (OPEN), newest first — consumes Epic 03's
  // round-status model (the same filter the /invitations picker uses).
  const liveRounds = rounds
    .filter((r) => r.status === "OPEN")
    .map((r) => ({ id: r.id, academicYear: r.academicYear }));

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3">
        <span className="mt-1 rounded-lg bg-primary-50 p-2 text-primary-900">
          <Users className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Contact register
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Curate the families you intend to invite. The school and academic
            year recorded here are locked — they carry through to the
            application and the parent cannot change them.
          </p>
        </div>
      </div>

      <ContactsTable
        contacts={contacts}
        liveRounds={liveRounds}
        defaultBcc={inviteBccAddress()}
      />
    </div>
  );
}
