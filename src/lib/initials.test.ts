import { describe, expect, it } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it.each([
    ["Dr. Avery North (synthetic)", "AN"],
    ["Dr. Demo Clinician", "DC"],
    ["Dr Avery North", "AN"],
    ["Prof. Mira Demoson", "MD"],
    ["Mr. Ellis Placeholder", "EP"],
    ["Mrs. Zoë Sampleton", "ZS"],
    ["Ms. Rowan Testcase", "RT"],
    ["Rowan Testcase, MD", "RT"],
    ["Dr. Naomi Fitzgerald, MD", "NF"],
    ["R. Okafor, PA-C", "RO"],
    ["Ellis Placeholder Jr.", "EP"],
    ["Ellis Placeholder III", "EP"],
    ["Dorothy A. Reyes", "DR"],
    ["Rowan Testcase [locum]", "RT"],
    ["Rowan {synthetic} Testcase", "RT"],
    ["Rowan", "R"],
    ["Dr. Rowan", "R"],
    ["  rowan   testcase  ", "RT"],
    ["Demo Administrator", "DA"],
    ["Mary-Jane Testcase", "MT"],
  ])("%s -> %s", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  it("keeps non-Latin scripts and combining marks whole", () => {
    expect(getInitials("محمد علي")).toBe("مع");
    expect(getInitials("د. ليلى حسن")).toBe("لح");
    expect(getInitials("Ελένη Παππά")).toBe("ΕΠ");
    expect(getInitials("e\u0301lise Testcase")).toBe("E\u0301T");
    expect(getInitials("이 서연")).toBe("이서");
    expect(getInitials("Øystein Ålvik")).toBe("ØÅ");
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
    expect(getInitials("(synthetic)")).toBe("");
    expect(getInitials("Dr.")).toBe("");
  });
});
