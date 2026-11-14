-- Widen the contact identity key to include the destination (school + entry
-- year), so the same child can hold a NEW contact for a different school or
-- entry year under the same parent login.
--
-- 14 Nov 2026: two Old Palace partner pupils (2026/27 contacts, already bound
-- to the parent's login) were re-entered as Trinity 2027/28 sixth-form
-- contacts. Sending the invite binds contact.profile_id to the existing login,
-- which collided with the old 3-column key (P2002) and blocked the invite.
--
-- Additive and safe on existing data: every row unique on the 3-column key is
-- unique on the 5-column superset, so the CREATE cannot fail. The new index is
-- created BEFORE the old one is dropped so uniqueness is never unenforced.

-- CreateIndex
CREATE UNIQUE INDEX "contacts_profile_id_child_name_child_dob_school_entry_year_key" ON "contacts"("profile_id", "child_name", "child_dob", "school", "entry_year");

-- DropIndex
DROP INDEX "contacts_profile_id_child_name_child_dob_key";
