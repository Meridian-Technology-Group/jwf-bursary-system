import { describe, it, expect } from "vitest";
import { declarationSchema } from "@/lib/schemas/declaration";
import { parentContactSchema } from "@/lib/schemas/parent-details";

describe("declarationSchema (Epic 02 PR-5)", () => {
  it("sole parent: P1 tick + name required, P2 absent → valid", () => {
    const r = declarationSchema.safeParse({
      acceptedParent1: true,
      signedOnBehalfOfParent1: "Jane Doe",
    });
    expect(r.success).toBe(true);
  });
  it("P1 not ticked → invalid", () => {
    const r = declarationSchema.safeParse({
      acceptedParent1: false,
      signedOnBehalfOfParent1: "Jane Doe",
    });
    expect(r.success).toBe(false);
  });
  it("dual parent: P2 block shown but not ticked → invalid", () => {
    const r = declarationSchema.safeParse({
      acceptedParent1: true,
      signedOnBehalfOfParent1: "Jane Doe",
      acceptedParent2: false,
      signedOnBehalfOfParent2: "John Doe",
    });
    expect(r.success).toBe(false);
  });
  it("dual parent: both ticked + named → valid", () => {
    const r = declarationSchema.safeParse({
      acceptedParent1: true,
      signedOnBehalfOfParent1: "Jane Doe",
      acceptedParent2: true,
      signedOnBehalfOfParent2: "John Doe",
    });
    expect(r.success).toBe(true);
  });
  it("dual parent: P2 ticked but unnamed → invalid", () => {
    const r = declarationSchema.safeParse({
      acceptedParent1: true,
      signedOnBehalfOfParent1: "Jane Doe",
      acceptedParent2: true,
      signedOnBehalfOfParent2: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("parentContactSchema — mandatory phone + email (Epic 02 PR-5)", () => {
  const base = {
    title: "MR" as const,
    firstName: "John",
    lastName: "Doe",
    addressLine1: "1 High St",
    city: "Croydon",
    postcode: "CR0 1AB",
    country: "United Kingdom",
  };
  it("requires an email", () => {
    const r = parentContactSchema.safeParse({ ...base, mobile: "07700900000" });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid email", () => {
    const r = parentContactSchema.safeParse({ ...base, mobile: "07700900000", email: "nope" });
    expect(r.success).toBe(false);
  });
  it("requires at least one phone (mobile or telephone)", () => {
    const r = parentContactSchema.safeParse({ ...base, email: "a@b.com" });
    expect(r.success).toBe(false);
  });
  it("valid with email + mobile", () => {
    const r = parentContactSchema.safeParse({ ...base, email: "a@b.com", mobile: "07700900000" });
    expect(r.success).toBe(true);
  });
  it("valid with email + landline telephone", () => {
    const r = parentContactSchema.safeParse({ ...base, email: "a@b.com", telephone: "02080000000" });
    expect(r.success).toBe(true);
  });
});
