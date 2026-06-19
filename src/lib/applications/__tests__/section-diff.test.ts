import { describe, it, expect } from "vitest";
import {
  diffSectionPaths,
  mergeProvenance,
  clearProvenance,
  type AssessorProvenanceMap,
} from "../section-diff";

const EDITOR = {
  id: "00000000-0000-4000-a000-000000000009",
  name: "Avery Assessor",
  at: "2026-06-12T10:00:00.000Z",
};

describe("diffSectionPaths — leaf-level deep diff (CR-001)", () => {
  it("returns [] for identical payloads", () => {
    const data = { fullName: "Jordan Chen", income: { salary: 42000 } };
    expect(diffSectionPaths(data, structuredClone(data))).toEqual([]);
  });

  it("reports a changed top-level leaf by name", () => {
    expect(
      diffSectionPaths({ fullName: "Jordan Chen" }, { fullName: "Jordan Cheng" })
    ).toEqual(["fullName"]);
  });

  it("reports nested object changes with dot paths", () => {
    expect(
      diffSectionPaths(
        { income: { salary: 42000, bonus: 1000 } },
        { income: { salary: 45000, bonus: 1000 } }
      )
    ).toEqual(["income.salary"]);
  });

  it("reports a changed array element by index", () => {
    expect(
      diffSectionPaths(
        { children: [{ fullName: "Ada" }, { fullName: "Chidi" }] },
        { children: [{ fullName: "Ada" }, { fullName: "Chidi Okafor" }] }
      )
    ).toEqual(["children.1.fullName"]);
  });

  it("reports an appended array element's leaves as added", () => {
    expect(
      diffSectionPaths(
        { children: [{ fullName: "Ada" }] },
        { children: [{ fullName: "Ada" }, { fullName: "Chidi" }] }
      )
    ).toEqual(["children.1.fullName"]);
  });

  it("reports a removed array element's leaves as removed", () => {
    expect(
      diffSectionPaths(
        { children: [{ fullName: "Ada" }, { fullName: "Chidi" }] },
        { children: [{ fullName: "Ada" }] }
      )
    ).toEqual(["children.1.fullName"]);
  });

  it("a shorter, reordered array reports every index whose value moved", () => {
    // Removing element 0 shifts every survivor down one slot: index-based
    // diffing reports each slot whose occupant changed, plus the lost tail.
    expect(
      diffSectionPaths({ schools: ["Whitgift", "Trinity", "Old Palace"] }, { schools: ["Trinity", "Old Palace"] })
    ).toEqual(["schools.0", "schools.1", "schools.2"]);
  });

  it("treats value→undefined (key deleted) as a change", () => {
    expect(
      diffSectionPaths({ phone: "020 7946 0000", email: "a@b.test" }, { email: "a@b.test" })
    ).toEqual(["phone"]);
  });

  it("treats value→null (field cleared) as a change", () => {
    expect(
      diffSectionPaths(
        { phone: "020 7946 0000", email: "a@b.test" },
        { phone: null, email: "a@b.test" }
      )
    ).toEqual(["phone"]);
  });

  it("treats null, undefined and missing as the SAME absent state", () => {
    expect(diffSectionPaths({ phone: null }, {})).toEqual([]);
    expect(diffSectionPaths({ phone: undefined }, { phone: null })).toEqual([]);
    expect(diffSectionPaths(null, {})).toEqual([]);
  });

  it("reports both shapes when a leaf becomes a nested object", () => {
    expect(diffSectionPaths({ address: "1 High St" }, { address: { line1: "1 High St" } })).toEqual([
      "address",
      "address.line1",
    ]);
  });

  it("returns sorted, deterministic output across multiple changes", () => {
    const paths = diffSectionPaths(
      { b: 1, a: { z: 1, y: 2 } },
      { b: 2, a: { z: 9, y: 2 }, c: true }
    );
    expect(paths).toEqual([...paths].sort());
    expect(paths).toEqual(["a.z", "b", "c"]);
  });

  it("non-object roots: compares directly and reports '(root)' when different", () => {
    expect(diffSectionPaths("draft", "draft")).toEqual([]);
    expect(diffSectionPaths("draft", "final")).toEqual(["(root)"]);
    expect(diffSectionPaths(42, { value: 42 })).toEqual(["(root)"]);
    expect(diffSectionPaths(null, "final")).toEqual(["(root)"]);
  });
});

describe("mergeProvenance — stamping assessor-edited paths", () => {
  it("stamps every changed path with the editor", () => {
    expect(mergeProvenance(null, ["fullName", "income.salary"], EDITOR)).toEqual({
      fullName: { editedBy: EDITOR.id, editedByName: EDITOR.name, editedAt: EDITOR.at },
      "income.salary": { editedBy: EDITOR.id, editedByName: EDITOR.name, editedAt: EDITOR.at },
    });
  });

  it("preserves untouched entries and overwrites colliding paths", () => {
    const existing: AssessorProvenanceMap = {
      fullName: { editedBy: "old-id", editedByName: "Old Assessor", editedAt: "2026-06-01T00:00:00.000Z" },
      phone: { editedBy: "old-id", editedByName: "Old Assessor", editedAt: "2026-06-01T00:00:00.000Z" },
    };
    const merged = mergeProvenance(existing, ["fullName"], EDITOR);
    expect(merged.fullName).toEqual({
      editedBy: EDITOR.id,
      editedByName: EDITOR.name,
      editedAt: EDITOR.at,
    });
    expect(merged.phone).toEqual(existing.phone);
    // Returns a NEW map — the stored payload is never mutated.
    expect(existing.fullName.editedBy).toBe("old-id");
  });

  it("tolerates garbage existing payloads (non-object, malformed entries)", () => {
    expect(mergeProvenance("corrupt", ["a"], EDITOR)).toEqual({
      a: { editedBy: EDITOR.id, editedByName: EDITOR.name, editedAt: EDITOR.at },
    });
    expect(mergeProvenance({ junk: 42 }, [], EDITOR)).toEqual({});
  });
});

describe("clearProvenance — applicant reclaiming fields pre-submission", () => {
  it("removes ONLY the listed paths", () => {
    const existing: AssessorProvenanceMap = {
      fullName: { editedBy: EDITOR.id, editedByName: EDITOR.name, editedAt: EDITOR.at },
      phone: { editedBy: EDITOR.id, editedByName: EDITOR.name, editedAt: EDITOR.at },
    };
    const cleared = clearProvenance(existing, ["fullName"]);
    expect(cleared).toEqual({ phone: existing.phone });
    // Returns a NEW map — the input keeps its entry.
    expect(existing.fullName).toBeDefined();
  });

  it("tolerates null existing and unknown paths", () => {
    expect(clearProvenance(null, ["fullName"])).toEqual({});
    expect(
      clearProvenance(
        { phone: { editedBy: "x", editedByName: "Y", editedAt: "z" } },
        ["never-stamped"]
      )
    ).toEqual({ phone: { editedBy: "x", editedByName: "Y", editedAt: "z" } });
  });
});
