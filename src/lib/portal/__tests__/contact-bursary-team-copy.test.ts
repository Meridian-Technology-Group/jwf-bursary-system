/**
 * CF-31 — the bursary team's email, in front of parents, verbatim.
 *
 * The Foundation asked for this wording and this address specifically: without
 * a named channel parents phone, and there is no call centre to answer. So the
 * wording is pinned character-for-character, and every surface that tells a
 * parent to get in touch is checked for it — a "contact the Foundation" with no
 * address is the exact failure being fixed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BURSARIES_CONTACT_EMAIL,
  CHECKLIST_UPLOAD_NOTES,
  CONTACT_BURSARY_TEAM_COPY,
} from "@/lib/portal/guidance-content";
import { SUBMISSION_DEADLINE_PASSED_MESSAGE } from "@/lib/applications/submission-error";

const SRC = path.resolve(__dirname, "../../..");

/** Portal surfaces that tell a parent to get in touch. */
const CONTACT_SURFACES = [
  "app/(portal)/page.tsx",
  "app/(portal)/reassessment-card.tsx",
  "app/(portal)/application-type-chooser.tsx",
  "components/portal/submission-countdown.tsx",
  "components/portal/portal-guidance-tabs.tsx",
];

describe("the contact copy is the Foundation's, verbatim", () => {
  it("uses the exact sentence and the exact address", () => {
    expect(BURSARIES_CONTACT_EMAIL).toBe("fees@johnwhitgiftfoundation.org");
    expect(CONTACT_BURSARY_TEAM_COPY).toBe(
      "please contact the bursary team by email at fees@johnwhitgiftfoundation.org"
    );
  });
});

describe("the address reaches the surfaces a parent would otherwise phone about", () => {
  it("appears in the checklist guidance", () => {
    expect(
      CHECKLIST_UPLOAD_NOTES.some((note) =>
        note.includes(CONTACT_BURSARY_TEAM_COPY)
      )
    ).toBe(true);
  });

  it("appears in the deadline lockout, which is the message most likely to prompt a call", () => {
    expect(SUBMISSION_DEADLINE_PASSED_MESSAGE).toContain(
      CONTACT_BURSARY_TEAM_COPY
    );
  });

  it("leaves no portal surface saying 'contact the Foundation' without naming a channel", () => {
    const offenders = CONTACT_SURFACES.filter((relative) => {
      const source = readFileSync(path.join(SRC, relative), "utf8");
      // The JSX is wrapped, so match on the phrase's distinctive words rather
      // than an exact string.
      return /contact\s+the\s+Foundation/.test(source.replace(/\s+/g, " "));
    });

    expect(offenders).toEqual([]);
  });

  it("renders the address as a mailto link on every one of those surfaces", () => {
    for (const relative of CONTACT_SURFACES) {
      const source = readFileSync(path.join(SRC, relative), "utf8");
      const linked =
        source.includes("ContactBursaryTeam") ||
        source.includes(`mailto:${"$"}{BURSARIES_CONTACT_EMAIL}`);
      expect(linked, `${relative} should link the bursary team's address`).toBe(
        true
      );
    }
  });
});
