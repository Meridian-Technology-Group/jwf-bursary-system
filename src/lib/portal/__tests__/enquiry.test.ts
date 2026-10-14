import { describe, it, expect } from "vitest";
import {
  cleanSubject,
  composeEnquiry,
  enquiryChildOptions,
  enquiryThrottle,
  escapeHtml,
  type EnquiryApplicationInput,
} from "../enquiry";
import { parseGuidanceTab } from "../guidance-content";

const PARENT = { firstName: "Pat", lastName: "Doe", email: "pat@example.com" };
const SENT = new Date("2026-10-14T13:05:00Z"); // 14:05 BST

function app(over: Partial<EnquiryApplicationInput> = {}): EnquiryApplicationInput {
  return {
    id: "app-1",
    childName: "Alex Doe",
    reference: "TS-DOE01-Doe, Alex",
    bursaryAccountId: null,
    academicYear: "2026-27",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

describe("enquiryChildOptions (D-14)", () => {
  it("one option per account, carrying its latest application's reference", () => {
    const options = enquiryChildOptions(
      [{ id: "acc-1", childName: "Alex Doe" }],
      [
        app({ id: "old", bursaryAccountId: "acc-1", reference: "Old ref" }),
        app({
          id: "new",
          bursaryAccountId: "acc-1",
          reference: "New ref",
          academicYear: "2027-28",
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      ]
    );
    expect(options).toEqual([
      { key: "account:acc-1", childName: "Alex Doe", reference: "New ref", applicationId: "new" },
    ]);
  });

  it("an account with no application yet has no reference", () => {
    expect(enquiryChildOptions([{ id: "acc-1", childName: "Alex Doe" }], [])).toEqual([
      { key: "account:acc-1", childName: "Alex Doe", reference: null, applicationId: null },
    ]);
  });

  it("a child with an application but no account gets its own option; name matches fold in", () => {
    const options = enquiryChildOptions(
      [{ id: "acc-1", childName: "Alex Doe" }],
      [
        app({ id: "a", childName: "alex  doe" }),
        app({ id: "b", childName: "Sam Doe", reference: "Sam ref" }),
      ]
    );
    expect(options.map((o) => [o.key, o.reference])).toEqual([
      ["account:acc-1", "TS-DOE01-Doe, Alex"],
      ["application:b", "Sam ref"],
    ]);
  });
});

describe("composeEnquiry (D-16)", () => {
  const child = {
    key: "account:acc-1",
    childName: "Alex Doe",
    reference: "TS-DOE01-Doe, Alex",
    applicationId: "app-1",
  };

  it("puts the reference, then the typed subject, in the subject line", () => {
    const { subject } = composeEnquiry({
      parent: PARENT,
      child,
      subject: "Change of address",
      body: "We have moved house.",
      sentAt: SENT,
      appUrl: "https://example.test/",
    });
    expect(subject).toBe(
      "Bursary portal question — TS-DOE01-Doe, Alex — Change of address"
    );
  });

  it("no application yet / general question", () => {
    const base = { parent: PARENT, body: "Hello there team", sentAt: SENT, appUrl: "x" };
    expect(
      composeEnquiry({ ...base, child: { ...child, reference: null, applicationId: null } })
        .subject
    ).toBe("Bursary portal question — Alex Doe (no application yet)");
    expect(composeEnquiry({ ...base, child: null }).subject).toBe(
      "Bursary portal question — general question"
    );
  });

  it("the body names the parent, the reply address, London time and the admin link", () => {
    const { text } = composeEnquiry({
      parent: PARENT,
      child,
      body: "  Do you need my P60?  ",
      sentAt: SENT,
      appUrl: "https://example.test/",
    });
    expect(text).toContain("From: Pat Doe <pat@example.com>");
    expect(text).toContain("Bursary reference: TS-DOE01-Doe, Alex");
    expect(text).toContain("14 Oct 2026, 14:05:00");
    expect(text).toContain("Question:\nDo you need my P60?");
    expect(text).toContain("answers Pat Doe at pat@example.com");
    expect(text).toContain("https://example.test/applications/app-1");
  });

  it("a profile with no name shows just the address", () => {
    const { text } = composeEnquiry({
      parent: { firstName: null, lastName: null, email: "pat@example.com" },
      child: null,
      body: "Hello there team",
      sentAt: SENT,
      appUrl: "x",
    });
    expect(text).toContain("From: pat@example.com\n");
    expect(text).toContain("answers the family at pat@example.com");
  });

  it("a typed subject can't inject a header line", () => {
    expect(cleanSubject("Hi\r\nBcc: someone@evil.example")).toBe(
      "Hi Bcc: someone@evil.example"
    );
    expect(cleanSubject("x".repeat(500))).toHaveLength(120);
  });
});

describe("escapeHtml", () => {
  it("neutralises markup typed into a question", () => {
    expect(escapeHtml(`<a href="x">click</a> & 'me'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;click&lt;/a&gt; &amp; &#39;me&#39;"
    );
  });
});

describe("enquiryThrottle (D-15)", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("allows the fifth question in an hour, refuses the sixth", () => {
    expect(enquiryThrottle([1, 2, 3, 4].map(minutesAgo), now).allowed).toBe(true);
    expect(enquiryThrottle([1, 2, 3, 4, 5].map(minutesAgo), now).allowed).toBe(false);
  });

  it("counts only the last hour for the hourly limit", () => {
    expect(enquiryThrottle([61, 62, 63, 64, 65].map(minutesAgo), now).allowed).toBe(true);
  });

  it("refuses the 21st in a day", () => {
    const day = Array.from({ length: 20 }, (_, i) => minutesAgo(70 + i * 60));
    expect(enquiryThrottle(day, now).allowed).toBe(false);
  });
});

describe("parseGuidanceTab (D-17)", () => {
  it("opens a known tab and ignores anything else", () => {
    expect(parseGuidanceTab("checklist")).toBe("checklist");
    expect(parseGuidanceTab(["terms"])).toBe("terms");
    expect(parseGuidanceTab("javascript:alert(1)")).toBe("how-to-apply");
    expect(parseGuidanceTab(undefined)).toBe("how-to-apply");
  });
});
