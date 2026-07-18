import { describe, it, expect } from "vitest";
import { buildSubmittedSummary } from "@/lib/portal/application-summary";

describe("buildSubmittedSummary (Epic 05 §3.3)", () => {
  it("renders child details and omits empty sections", () => {
    const summary = buildSubmittedSummary({
      sections: [
        {
          section: "CHILD_DETAILS",
          data: {
            childFullName: "Alex Smith",
            dateOfBirth: "2014-03-02",
            school: "WHITGIFT",
            currentSchool: "St Mary's",
            placeOfBirth: "London",
            sameAddressAsParent1: true,
          },
        },
      ],
      documents: [],
    });
    const child = summary.sections.find(
      (s) => s.sectionType === "CHILD_DETAILS"
    );
    expect(child).toBeDefined();
    expect(child?.rows.find((r) => r.label === "Name")?.value).toBe(
      "Alex Smith"
    );
    expect(child?.rows.find((r) => r.label === "School applying for")?.value).toBe(
      "Whitgift School"
    );
    // No PARENT_DETAILS provided ⇒ not present (empty sections omitted)
    expect(
      summary.sections.find((s) => s.sectionType === "PARENT_DETAILS")
    ).toBeUndefined();
  });

  it("shows Year of entry from the Application entry year (not the empty blob)", () => {
    const summary = buildSubmittedSummary({
      sections: [
        {
          section: "CHILD_DETAILS",
          data: {
            childFullName: "Alex Smith",
            dateOfBirth: "2014-03-02",
            school: "WHITGIFT",
            placeOfBirth: "London",
            sameAddressAsParent1: true,
          },
        },
      ],
      documents: [],
      entryYear: 2027,
      entryYearGroup: "Y7",
    });
    const child = summary.sections.find((s) => s.sectionType === "CHILD_DETAILS");
    expect(child?.rows.find((r) => r.label === "Year of entry")?.value).toBe(
      "2027 (Year 7)"
    );
  });

  it("dependent children table shows School/School address, not a phantom 'Date registered'", () => {
    const summary = buildSubmittedSummary({
      sections: [
        {
          section: "DEPENDENT_CHILDREN",
          data: {
            numberOfDependentChildren: 1,
            children: [
              {
                id: "c1",
                name: "Alex Smith",
                school: "St Mary's",
                schoolAddress: "1 High St",
                isNamedChild: true,
              },
            ],
          },
        },
      ],
      documents: [],
    });
    const dc = summary.sections.find(
      (s) => s.sectionType === "DEPENDENT_CHILDREN"
    );
    const table = dc?.tables?.[0];
    expect(table?.columns).toEqual([
      "Name",
      "School",
      "School address",
      "Named on application",
    ]);
    expect(table?.columns).not.toContain("Date registered");
    expect(table?.rows[0]).toEqual([
      "Alex Smith",
      "St Mary's",
      "1 High St",
      "Yes",
    ]);
  });

  it("attaches uploaded documents to their owning section", () => {
    const summary = buildSubmittedSummary({
      sections: [
        {
          section: "CHILD_DETAILS",
          data: { childFullName: "Alex", school: "TRINITY" },
        },
      ],
      documents: [
        { slot: "BIRTH_CERTIFICATE", filename: "birth-cert.pdf" },
        { slot: "P60_PARENT_1", filename: "p60.pdf" },
      ],
    });
    const child = summary.sections.find(
      (s) => s.sectionType === "CHILD_DETAILS"
    );
    expect(child?.documents?.map((d) => d.filename)).toContain("birth-cert.pdf");
    // P60 belongs to PARENTS_INCOME, not child details
    expect(child?.documents?.map((d) => d.filename)).not.toContain("p60.pdf");
  });

  it("totals income across both parents (status-driven shape)", () => {
    const summary = buildSubmittedSummary({
      sections: [
        {
          section: "PARENTS_INCOME",
          data: {
            parent1Income: { employed: { annualSalaryPaye: 30000 } },
            parent2Income: { employed: { annualSalaryPaye: 20000 } },
          },
        },
      ],
      documents: [],
    });
    const income = summary.sections.find(
      (s) => s.sectionType === "PARENTS_INCOME"
    );
    expect(income).toBeDefined();
    expect(
      income?.rows.find((r) => r.label === "Combined total income")?.value
    ).toBe("£50,000");
    // one table per parent
    expect(income?.tables?.length).toBe(2);
  });

  it("produces an empty summary for no usable sections", () => {
    const summary = buildSubmittedSummary({ sections: [], documents: [] });
    expect(summary.sections).toHaveLength(0);
  });
});
