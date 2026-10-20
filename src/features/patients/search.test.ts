import { describe, expect, it } from "vitest";
import { filterPatients, parsePatientQuery, PATIENT_QUERY_MAX } from "./search";

const PATIENTS = [
  { given_name: "Rowan", family_name: "Testcase", mrn: "SYN-000101" },
  { given_name: "Mira", family_name: "Demoson", mrn: "SYN-000102" },
  { given_name: "Zoë", family_name: "Sampleton", mrn: "SYN-000203" },
];

describe("parsePatientQuery", () => {
  it("collapses whitespace, trims, and takes the first value", () => {
    expect(parsePatientQuery("  rowan   test ")).toBe("rowan test");
    expect(parsePatientQuery(["mira", "ignored"])).toBe("mira");
    expect(parsePatientQuery(undefined)).toBe("");
  });

  it("caps the length", () => {
    expect(parsePatientQuery("a".repeat(PATIENT_QUERY_MAX + 20))).toHaveLength(PATIENT_QUERY_MAX);
  });
});

describe("filterPatients", () => {
  it("returns everyone for an empty query", () => {
    expect(filterPatients(PATIENTS, "")).toHaveLength(3);
  });

  it("matches names and MRNs case-insensitively", () => {
    expect(filterPatients(PATIENTS, "ROWAN").map((p) => p.family_name)).toEqual(["Testcase"]);
    expect(filterPatients(PATIENTS, "syn-0002").map((p) => p.family_name)).toEqual(["Sampleton"]);
  });

  it("requires every term to match", () => {
    expect(filterPatients(PATIENTS, "rowan testcase")).toHaveLength(1);
    expect(filterPatients(PATIENTS, "rowan demoson")).toHaveLength(0);
  });

  it("ignores diacritics", () => {
    expect(filterPatients(PATIENTS, "zoe").map((p) => p.family_name)).toEqual(["Sampleton"]);
  });

  it("treats wildcard and filter characters as plain text", () => {
    expect(filterPatients(PATIENTS, "%")).toHaveLength(0);
    expect(filterPatients(PATIENTS, "a,b)")).toHaveLength(0);
  });
});
