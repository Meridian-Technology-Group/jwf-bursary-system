// Epic 14 B2 (CG-07/CG-08, LA-2) — Charlotte's missing-documents email copy.
//
// The template ships in migration 20260816160000 (migrations are the single
// source of truth for email templates). These tests read the migration's SQL
// and render the ACTUAL shipped subject/body through the real merge engine,
// so a later edit that breaks a placeholder or drops her wording fails here.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { replaceMergeFields } from "../merge";

const SQL = readFileSync(
  path.join(
    __dirname,
    "../../../../prisma/migrations/20260816160000_e14_missing_docs_template_copy/migration.sql"
  ),
  "utf8"
);

const SUBJECT = "JWF - Your bursary assessment has been paused.";
const BODY = SQL.split("$body$")[1];

describe("MISSING_DOCS template copy (CG-08, verbatim)", () => {
  it("ships Charlotte's subject verbatim", () => {
    expect(SQL).toContain(`'${SUBJECT}'`);
  });

  it("carries her body wording and the three merge fields", () => {
    expect(BODY).toContain("Dear {{applicant_name}}");
    expect(BODY).toContain(
      "We have had to pause our assessment as we are missing the following clarification/documents:"
    );
    expect(BODY).toContain("{{missing_documents}}");
    expect(BODY).toContain(
      "Please kindly send us by email these documents and we will attach them to your application."
    );
    expect(BODY).toContain(
      "Please ensure that we receive these additional document/information by {{deadline}}"
    );
    expect(BODY).toContain("Kind regards");
    expect(BODY).toContain("JWF Bursary team");
    // LA-2: the email deliberately does not mention the portal respond flow,
    // and her copy has no slot for the dialog's personal note.
    expect(BODY).not.toContain("portal");
    expect(BODY).not.toContain("{{custom_message}}");
  });

  it("renders with the merge data the pause action supplies", () => {
    // Mirrors the action: bulleted humanised slot list + en-GB date.
    const slotList = [
      "• Universal Credit 12-month statement",
      "• Monthly UC payment 2",
    ].join("\n");
    const deadline = new Date(Date.UTC(2026, 7, 21)).toLocaleDateString(
      "en-GB"
    );

    const rendered = replaceMergeFields(BODY, {
      applicant_name: "Alex Parent",
      missing_documents: slotList,
      deadline,
    });

    expect(rendered).toContain("Dear Alex Parent");
    expect(rendered).toContain("• Universal Credit 12-month statement");
    expect(rendered).toContain("• Monthly UC payment 2");
    expect(rendered).toContain("by 21/08/2026");
    expect(rendered).not.toMatch(/\{\{.*\}\}/);
  });
});
