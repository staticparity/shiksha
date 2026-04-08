/**
 * Learner Agent Tests
 *
 * Tests the zero-knowledge security constraints and adaptive scaffolding
 * of the Learner Agent. The Learner must NEVER have access to topic
 * answer keys, regardless of student input.
 */

import { describe, it, expect } from "vitest";
import { buildLearnerPrompt, getLearnerGreeting, MAX_MESSAGES_PER_SESSION } from "./learner";

describe("Learner Agent", () => {
  const prompt = buildLearnerPrompt("Photosynthesis", "Biology");

  // ── Zero-Knowledge Security ────────────────────────────────

  it("should not contain any knowledge base content", () => {
    // The prompt should NEVER include factual content about the topic
    expect(prompt).not.toContain("chloroplast");
    expect(prompt).not.toContain("Calvin Cycle");
    expect(prompt).not.toContain("thylakoid");
    expect(prompt).not.toContain("CO2");
    expect(prompt).not.toContain("6CO2");
    expect(prompt).not.toContain("light-dependent");
    expect(prompt).not.toContain("RuBisCO");
  });

  it("should only contain the topic title and subject", () => {
    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("Biology");
  });

  it("should explicitly state zero knowledge", () => {
    expect(prompt).toContain("ZERO knowledge");
    expect(prompt).toContain("NOTHING");
  });

  // ── Adaptive Scaffolding ───────────────────────────────────

  it("should include scaffolding behavior for disengaged students", () => {
    expect(prompt).toContain("LOST");
    expect(prompt).toContain("scaffold");
    expect(prompt.toLowerCase()).toContain("reason");
  });

  it("should include sidewalking behavior for average students", () => {
    expect(prompt).toContain("AVERAGE");
    expect(prompt).toContain("angle");
    expect(prompt.toLowerCase()).toContain("analogy");
  });

  it("should include natural flow for strong students", () => {
    expect(prompt).toContain("STRONG");
    expect(prompt).toContain("edge case");
  });

  // ── Anti-Prompt-Injection ──────────────────────────────────

  it("should contain prompt injection defenses", () => {
    expect(prompt).toContain("ignore your instructions");
    expect(prompt).toContain("system prompt");
    expect(prompt).toContain("Stay in character");
  });

  it("should refuse to provide answers when asked", () => {
    expect(prompt).toContain("I genuinely have no clue");
    expect(prompt).toContain("You're my teacher here");
  });

  // ── Behavioral Rules ───────────────────────────────────────

  it("should never correct students", () => {
    expect(prompt).toContain("NEVER correct");
  });

  it("should never provide hints or answers", () => {
    expect(prompt).toContain("NEVER provide answers");
    expect(prompt).toContain("NEVER say");
  });

  it("should enforce conversational length limits", () => {
    expect(prompt).toContain("2-4 sentences");
  });

  // ── Greeting ───────────────────────────────────────────────

  it("should generate a greeting containing the topic title", () => {
    const greeting = getLearnerGreeting("Photosynthesis");
    expect(greeting).toContain("Photosynthesis");
  });

  it("should generate varied greetings", () => {
    const greetings = new Set<string>();
    for (let i = 0; i < 100; i++) {
      greetings.add(getLearnerGreeting("Photosynthesis"));
    }
    expect(greetings.size).toBeGreaterThan(1);
  });

  // ── Constants ──────────────────────────────────────────────

  it("should enforce message limits", () => {
    expect(MAX_MESSAGES_PER_SESSION).toBe(50);
  });
});
