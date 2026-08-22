import { describe, it, expect } from "vitest";
import { EmailTemplateType, InvitationSituation, School } from "@prisma/client";
import {
  INVITATION_TEMPLATE_TYPES,
  TEMPLATE_LABELS,
  emailTemplateLabel,
  isLegacyInvitationFallback,
} from "../template-labels";
import { resolveInvitationTemplate } from "../invitation-template";

describe("emailTemplateLabel", () => {
  it("labels a system template from its type", () => {
    expect(
      emailTemplateLabel({
        isSystem: true,
        type: EmailTemplateType.INVITATION_INTERNAL_WS,
        name: null,
      })
    ).toBe("Invitation — Internal Application, Whitgift");
  });

  it("labels a custom template from its name", () => {
    expect(
      emailTemplateLabel({ isSystem: false, type: null, name: "Round opening" })
    ).toBe("Round opening");
  });

  it("falls back to a placeholder for an unnamed custom template", () => {
    expect(
      emailTemplateLabel({ isSystem: false, type: null, name: null })
    ).toBe("Untitled template");
  });

  it("has a label for every template type", () => {
    for (const type of Object.values(EmailTemplateType)) {
      expect(TEMPLATE_LABELS[type], `missing label for ${type}`).toBeTruthy();
    }
  });
});

// ── CH-28 (Charlotte, 2026-08-22) ───────────────────────────────────────────
//
// She asked for per-situation invitation templates that already existed,
// because the settings picker listed the legacy generic fallback FIRST and the
// five real variants last. These tests pin the two things that made that
// mistake possible: which templates count as invitations, and that the legacy
// one is flagged as legacy.

describe("invitation template grouping (CH-28)", () => {
  it("covers every template a real invitation send can resolve to", () => {
    // Exhaustive over the resolver's inputs: no situation, each situation, each
    // school. Whatever it can return MUST appear in the picker's invitation
    // group, or an editable live template would be filed under "other".
    const situations = [
      null,
      undefined,
      ...Object.values(InvitationSituation),
    ] as (InvitationSituation | null | undefined)[];
    const schools = [null, undefined, ...Object.values(School)] as (
      | School
      | null
      | undefined
    )[];

    const resolved = new Set<string>();
    for (const situation of situations) {
      for (const school of schools) {
        resolved.add(resolveInvitationTemplate(situation, school));
      }
    }

    for (const type of resolved) {
      expect(
        INVITATION_TEMPLATE_TYPES,
        `${type} is resolvable but missing from the invitation group`
      ).toContain(type);
    }
  });

  it("orders the live variants before the legacy fallback", () => {
    // The fallback must sort last: putting it first is exactly what hid the
    // real variants from her.
    expect(INVITATION_TEMPLATE_TYPES.at(-1)).toBe(EmailTemplateType.INVITATION);
    expect(INVITATION_TEMPLATE_TYPES[0]).not.toBe(EmailTemplateType.INVITATION);
  });

  it("lists no duplicates and only real template types", () => {
    expect(new Set(INVITATION_TEMPLATE_TYPES).size).toBe(
      INVITATION_TEMPLATE_TYPES.length
    );
    for (const type of INVITATION_TEMPLATE_TYPES) {
      expect(Object.values(EmailTemplateType)).toContain(type);
    }
  });

  it("flags only the generic template as the legacy fallback", () => {
    expect(isLegacyInvitationFallback(EmailTemplateType.INVITATION)).toBe(true);
    for (const type of INVITATION_TEMPLATE_TYPES.filter(
      (t) => t !== EmailTemplateType.INVITATION
    )) {
      expect(isLegacyInvitationFallback(type)).toBe(false);
    }
    expect(isLegacyInvitationFallback(null)).toBe(false);
    expect(isLegacyInvitationFallback(undefined)).toBe(false);
  });

  it("says outright that the legacy label is not used for new sends", () => {
    // The label is the whole mitigation — if it stops saying so, the trap is
    // back.
    expect(TEMPLATE_LABELS.INVITATION.toLowerCase()).toContain("legacy");
    expect(TEMPLATE_LABELS.INVITATION.toLowerCase()).toContain("not used");
  });

  it("resolves her three real internal invitations to a variant, never the fallback", () => {
    // Jack Curror (Whitgift) and Aditya JAYAPRAKASH / Denzel Williams
    // (Trinity) are all situation=INTERNAL.
    expect(
      resolveInvitationTemplate(InvitationSituation.INTERNAL, School.WHITGIFT)
    ).toBe(EmailTemplateType.INVITATION_INTERNAL_WS);
    expect(
      resolveInvitationTemplate(InvitationSituation.INTERNAL, School.TRINITY)
    ).toBe(EmailTemplateType.INVITATION_INTERNAL_TS);
  });
});
