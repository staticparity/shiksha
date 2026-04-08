import { describe, it, expect } from "vitest";
import {
  sortGapsBySeverity,
  getGapColor,
  getGapBgColor,
  getGapSeverityLabel,
} from "./gap-detector";

describe("sortGapsBySeverity", () => {
  it("sorts critical before moderate before minor", () => {
    const gaps = [
      { concept: "A", severity: "minor" as const, explanation: "..." },
      { concept: "B", severity: "critical" as const, explanation: "..." },
      { concept: "C", severity: "moderate" as const, explanation: "..." },
    ];

    const sorted = sortGapsBySeverity(gaps);
    expect(sorted[0].concept).toBe("B"); // critical first
    expect(sorted[1].concept).toBe("C"); // moderate second
    expect(sorted[2].concept).toBe("A"); // minor last
  });

  it("handles empty array", () => {
    expect(sortGapsBySeverity([])).toEqual([]);
  });

  it("preserves order for same severity", () => {
    const gaps = [
      { concept: "A", severity: "critical" as const, explanation: "..." },
      { concept: "B", severity: "critical" as const, explanation: "..." },
    ];

    const sorted = sortGapsBySeverity(gaps);
    expect(sorted[0].concept).toBe("A");
    expect(sorted[1].concept).toBe("B");
  });
});

describe("getGapColor", () => {
  it("returns red for critical", () => {
    expect(getGapColor("critical")).toContain("beginning");
  });

  it("returns amber for moderate", () => {
    expect(getGapColor("moderate")).toContain("developing");
  });

  it("returns tertiary for minor", () => {
    expect(getGapColor("minor")).toContain("secondary");
  });
});

describe("getGapBgColor", () => {
  it("returns background colors for each severity", () => {
    expect(getGapBgColor("critical")).toBeTruthy();
    expect(getGapBgColor("moderate")).toBeTruthy();
    expect(getGapBgColor("minor")).toBeTruthy();
  });
});

describe("getGapSeverityLabel", () => {
  it("returns correct labels", () => {
    expect(getGapSeverityLabel("critical")).toBe("Critical Gap");
    expect(getGapSeverityLabel("moderate")).toBe("Needs Work");
    expect(getGapSeverityLabel("minor")).toBe("Minor Gap");
  });
});
