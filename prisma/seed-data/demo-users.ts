// prisma/seed-data/demo-users.ts
// Demo user profile data — profile rows only, not Supabase auth users.
// Fixed UUIDs allow deterministic cross-referencing from demo applications.

export type DemoRole = "ASSESSOR" | "APPLICANT";

export interface DemoUser {
  id: string;
  role: DemoRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

// Fixed UUIDs — version 4 format, deterministic by position
export const ASSESSOR_ID   = "00000000-0000-4000-a000-000000000001";
export const APPLICANT_1_ID = "00000000-0000-4000-a000-000000000002"; // Adaeze Okafor
export const APPLICANT_2_ID = "00000000-0000-4000-a000-000000000003"; // Priya Patel
export const APPLICANT_3_ID = "00000000-0000-4000-a000-000000000004"; // Sarah Williams
export const APPLICANT_4_ID = "00000000-0000-4000-a000-000000000005"; // Wei Chen

export const demoUsers: DemoUser[] = [
  {
    id: ASSESSOR_ID,
    role: "ASSESSOR",
    firstName: "Beverly",
    lastName: "Williams",
    email: "beverly.williams@jwf-bursary.test",
    phone: "020 7946 0001",
  },
  {
    id: APPLICANT_1_ID,
    role: "APPLICANT",
    firstName: "Adaeze",
    lastName: "Okafor",
    email: "adaeze.okafor@jwf-bursary.test",
    phone: "07700 900001",
  },
  {
    id: APPLICANT_2_ID,
    role: "APPLICANT",
    firstName: "Priya",
    lastName: "Patel",
    email: "priya.patel@jwf-bursary.test",
    phone: "07700 900002",
  },
  {
    id: APPLICANT_3_ID,
    role: "APPLICANT",
    firstName: "Sarah",
    lastName: "Williams",
    email: "sarah.williams@jwf-bursary.test",
    phone: "07700 900003",
  },
  {
    id: APPLICANT_4_ID,
    role: "APPLICANT",
    firstName: "Wei",
    lastName: "Chen",
    email: "wei.chen@jwf-bursary.test",
    phone: "07700 900004",
  },
];
