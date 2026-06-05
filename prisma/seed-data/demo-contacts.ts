// prisma/seed-data/demo-contacts.ts
// Demo fixtures for the lead-applicant contact register (Epic 04).
//
// Exercises every linkage state plus a twin pair proving the DOB dedupe key:
//   1. a fresh contact — no profile, no invite (state: New)
//   2. a contact already bound to a registered family (Okafor) + ACTIVE account
//   3. a returning contact linked to an ACTIVE BursaryAccount (Patel)
//   4. + 5. a TWIN PAIR — same childName, distinct childDob (D12). Both are
//      fresh so the register shows two distinct contacts for one family.
//
// `createdBy` is the demo ADMIN. `school`/`entryYear` are required (locked, D1).

import { ADMIN_ID, APPLICANT_1_ID, APPLICANT_2_ID } from "./demo-users";
import { ACCOUNT_OKAFOR_ID, ACCOUNT_PATEL_ID } from "./demo-applications";

export const CONTACT_FRESH_ID = "00000000-0000-4000-c000-000000000001";
export const CONTACT_OKAFOR_ID = "00000000-0000-4000-c000-000000000002";
export const CONTACT_PATEL_ID = "00000000-0000-4000-c000-000000000003";
export const CONTACT_TWIN_A_ID = "00000000-0000-4000-c000-000000000004";
export const CONTACT_TWIN_B_ID = "00000000-0000-4000-c000-000000000005";

export interface DemoContact {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  childName: string;
  childDob: Date | null;
  school: "TRINITY" | "WHITGIFT";
  entryYear: number;
  entryYearGroup: "Y6" | "Y7" | "Y9" | "Y12" | "OTHER" | null;
  addressLine1: string | null;
  town: string | null;
  postcode: string | null;
  profileId: string | null;
  bursaryAccountId: string | null;
  createdBy: string;
}

export const demoContacts: DemoContact[] = [
  {
    id: CONTACT_FRESH_ID,
    firstName: "Grace",
    lastName: "Adeyemi",
    email: "grace.adeyemi@example.test",
    phone: "020 7000 1001",
    childName: "Daniel Adeyemi",
    childDob: new Date("2014-09-12T00:00:00.000Z"),
    school: "WHITGIFT",
    entryYear: 2026,
    entryYearGroup: "Y7",
    addressLine1: "12 Elm Grove",
    town: "Croydon",
    postcode: "CR0 1AB",
    profileId: null,
    bursaryAccountId: null,
    createdBy: ADMIN_ID,
  },
  {
    id: CONTACT_OKAFOR_ID,
    firstName: "Adaeze",
    lastName: "Okafor",
    email: "adaeze.okafor@jwf-bursary.test",
    phone: "020 7000 1002",
    childName: "Chidi Okafor",
    childDob: new Date("2013-03-04T00:00:00.000Z"),
    school: "TRINITY",
    entryYear: 2025,
    entryYearGroup: "Y9",
    addressLine1: "5 Maple Court",
    town: "Croydon",
    postcode: "CR2 6XY",
    profileId: APPLICANT_1_ID,
    bursaryAccountId: ACCOUNT_OKAFOR_ID,
    createdBy: ADMIN_ID,
  },
  {
    id: CONTACT_PATEL_ID,
    firstName: "Priya",
    lastName: "Patel",
    email: "priya.patel@jwf-bursary.test",
    phone: "020 7000 1003",
    childName: "Anaya Patel",
    childDob: new Date("2012-11-21T00:00:00.000Z"),
    school: "WHITGIFT",
    entryYear: 2024,
    entryYearGroup: "Y12",
    addressLine1: "88 Oak Road",
    town: "Croydon",
    postcode: "CR4 3LM",
    profileId: APPLICANT_2_ID,
    bursaryAccountId: ACCOUNT_PATEL_ID,
    createdBy: ADMIN_ID,
  },
  // Twin pair — same childName, distinct childDob would NOT be twins; real twins
  // share a DOB but differ in name. Per D12 the key is (childName + DOB), so we
  // model two siblings of the SAME family with the SAME first name but DIFFERENT
  // DOB (the collision the old childName-only key could not separate). Distinct
  // DOB ⇒ two distinct contacts, two accounts.
  {
    id: CONTACT_TWIN_A_ID,
    firstName: "Mei",
    lastName: "Chen",
    email: "mei.chen@example.test",
    phone: "020 7000 1004",
    childName: "Jordan Chen",
    childDob: new Date("2015-06-01T00:00:00.000Z"),
    school: "TRINITY",
    entryYear: 2026,
    entryYearGroup: "Y6",
    addressLine1: "3 Birch Lane",
    town: "Croydon",
    postcode: "CR5 2QP",
    profileId: null,
    bursaryAccountId: null,
    createdBy: ADMIN_ID,
  },
  {
    id: CONTACT_TWIN_B_ID,
    firstName: "Mei",
    lastName: "Chen",
    email: "mei.chen@example.test",
    phone: "020 7000 1004",
    childName: "Jordan Chen",
    childDob: new Date("2017-02-18T00:00:00.000Z"),
    school: "TRINITY",
    entryYear: 2026,
    entryYearGroup: "Y6",
    addressLine1: "3 Birch Lane",
    town: "Croydon",
    postcode: "CR5 2QP",
    profileId: null,
    bursaryAccountId: null,
    createdBy: ADMIN_ID,
  },
];
