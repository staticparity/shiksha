import { describe, it, expect } from "vitest";
import { formatDuration, formatRelativeTime, formatMasteryScore } from "./format";

describe("formatDuration", () => {
  it("formats zero seconds as 00:00", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatDuration(45)).toBe("00:45");
  });

  it("formats minutes and seconds with padding", () => {
    expect(formatDuration(125)).toBe("02:05");
  });

  it("pads single-digit seconds and minutes", () => {
    expect(formatDuration(62)).toBe("01:02");
  });

  it("formats large durations", () => {
    expect(formatDuration(3661)).toBe("61:01");
  });
});

describe("formatMasteryScore", () => {
  it("formats valid score as percentage", () => {
    expect(formatMasteryScore(85)).toBe("85%");
  });

  it("returns -- for null", () => {
    expect(formatMasteryScore(null)).toBe("--");
  });

  it("returns -- for undefined", () => {
    expect(formatMasteryScore(undefined)).toBe("--");
  });

  it("handles zero score", () => {
    expect(formatMasteryScore(0)).toBe("0%");
  });

  it("handles 100", () => {
    expect(formatMasteryScore(100)).toBe("100%");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns hours ago for timestamps within a day", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toBe("2 hours ago");
  });

  it("returns 'yesterday' for 1 day ago", () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(oneDayAgo);
    expect(result).toBe("yesterday");
  });

  it("returns days ago for 2+ day old timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toBe("3 days ago");
  });

  it("returns minutes ago for recent past", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 min ago");
  });
});
