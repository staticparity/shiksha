import { describe, it, expect } from "vitest";
import {
  calculateCredits,
  getMasteryLevel,
  getMasteryColor,
  getMasteryEmoji,
  calculateOverallProgress,
} from "./mastery-calculator";

describe("calculateCredits", () => {
  it("returns 0 for scores below 40", () => {
    expect(calculateCredits(0)).toBe(0);
    expect(calculateCredits(10)).toBe(0);
    expect(calculateCredits(39)).toBe(0);
  });

  it("returns 1 for scores 40-69", () => {
    expect(calculateCredits(40)).toBe(1);
    expect(calculateCredits(55)).toBe(1);
    expect(calculateCredits(69)).toBe(1);
  });

  it("returns 2 for scores 70-89", () => {
    expect(calculateCredits(70)).toBe(2);
    expect(calculateCredits(80)).toBe(2);
    expect(calculateCredits(89)).toBe(2);
  });

  it("returns 3 for scores 90-100", () => {
    expect(calculateCredits(90)).toBe(3);
    expect(calculateCredits(95)).toBe(3);
    expect(calculateCredits(100)).toBe(3);
  });

  it("handles boundary values exactly", () => {
    expect(calculateCredits(39)).toBe(0);
    expect(calculateCredits(40)).toBe(1);
    expect(calculateCredits(69)).toBe(1);
    expect(calculateCredits(70)).toBe(2);
    expect(calculateCredits(89)).toBe(2);
    expect(calculateCredits(90)).toBe(3);
  });
});

describe("getMasteryLevel", () => {
  it("returns 'unattempted' for null", () => {
    expect(getMasteryLevel(null)).toBe("unattempted");
  });

  it("returns 'beginning' for 0-39", () => {
    expect(getMasteryLevel(0)).toBe("beginning");
    expect(getMasteryLevel(20)).toBe("beginning");
    expect(getMasteryLevel(39)).toBe("beginning");
  });

  it("returns 'developing' for 40-69", () => {
    expect(getMasteryLevel(40)).toBe("developing");
    expect(getMasteryLevel(55)).toBe("developing");
    expect(getMasteryLevel(69)).toBe("developing");
  });

  it("returns 'proficient' for 70-89", () => {
    expect(getMasteryLevel(70)).toBe("proficient");
    expect(getMasteryLevel(80)).toBe("proficient");
    expect(getMasteryLevel(89)).toBe("proficient");
  });

  it("returns 'expert' for 90-100", () => {
    expect(getMasteryLevel(90)).toBe("expert");
    expect(getMasteryLevel(100)).toBe("expert");
  });
});

describe("getMasteryColor", () => {
  it("returns gray for null/unattempted", () => {
    expect(getMasteryColor(null)).toContain("text-tertiary");
  });

  it("returns red for beginning", () => {
    expect(getMasteryColor(20)).toContain("mastery-beginning");
  });

  it("returns amber for developing", () => {
    expect(getMasteryColor(55)).toContain("mastery-developing");
  });

  it("returns teal for proficient", () => {
    expect(getMasteryColor(75)).toContain("mastery-proficient");
  });

  it("returns green for expert", () => {
    expect(getMasteryColor(95)).toContain("mastery-expert");
  });
});

describe("getMasteryEmoji", () => {
  it("returns gray circle for null", () => {
    expect(getMasteryEmoji(null)).toBe("⚪");
  });

  it("returns appropriate emoji for each level", () => {
    expect(getMasteryEmoji(20)).toBeTruthy();
    expect(getMasteryEmoji(55)).toBeTruthy();
    expect(getMasteryEmoji(75)).toBeTruthy();
    expect(getMasteryEmoji(95)).toBeTruthy();
  });
});

describe("calculateOverallProgress", () => {
  it("returns 0 for empty array", () => {
    expect(calculateOverallProgress([])).toBe(0);
  });

  it("returns 0 when all null", () => {
    expect(calculateOverallProgress([null, null, null])).toBe(0);
  });

  it("counts topics above mastery threshold", () => {
    // 80 >= 70 (counts), 60 < 70 (doesn't count), null (doesn't count) = 1/3 = 33%
    expect(calculateOverallProgress([80, 60, null])).toBe(33);
  });

  it("returns 100 for all perfect", () => {
    expect(calculateOverallProgress([100, 100])).toBe(100);
  });
});
