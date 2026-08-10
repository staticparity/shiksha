import { describe, it, expect } from "vitest";
import {
  getMisconceptionColor,
  getMisconceptionBgColor,
  getMisconceptionLabel,
  getMisconceptionIcon,
} from "./misconception-detector";

describe("getMisconceptionColor", () => {
  it("returns green for corrected", () => {
    expect(getMisconceptionColor("corrected")).toContain("proficient");
  });

  it("returns amber for active", () => {
    expect(getMisconceptionColor("active")).toContain("developing");
  });

  it("returns red for accepted — the safeguard case gets the strongest treatment", () => {
    expect(getMisconceptionColor("accepted")).toContain("beginning");
  });
});

describe("getMisconceptionBgColor", () => {
  it("returns background colors for each status", () => {
    expect(getMisconceptionBgColor("corrected")).toBeTruthy();
    expect(getMisconceptionBgColor("active")).toBeTruthy();
    expect(getMisconceptionBgColor("accepted")).toBeTruthy();
  });
});

describe("getMisconceptionLabel", () => {
  it("returns correct labels", () => {
    expect(getMisconceptionLabel("corrected")).toBe("Corrected this session");
    expect(getMisconceptionLabel("active")).toBe("Flagged — revisit");
    expect(getMisconceptionLabel("accepted")).toBe("Correction needed");
  });
});

describe("getMisconceptionIcon", () => {
  it("returns a checkmark for corrected and warnings for the other two", () => {
    expect(getMisconceptionIcon("corrected")).toBe("✓");
    expect(getMisconceptionIcon("active")).toBe("⚠");
    expect(getMisconceptionIcon("accepted")).toBe("⚠");
  });
});
