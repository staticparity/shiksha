/**
 * Learner Agent Tests
 *
 * Tests the zero-knowledge security constraints, adaptive scaffolding,
 * and evaluator integration of the Learner Agent.
 */

import { describe, it, expect } from "vitest";
import { buildLearnerPrompt, getLearnerGreeting, MAX_MESSAGES_PER_SESSION } from "./learner";

describe("Learner Agent", () => {
  // ── Without Evaluator Critique ────────────────────────────

  describe("without critique (first message)", () => {
    const prompt = buildLearnerPrompt("Photosynthesis", "Biology");

    it("should not contain any knowledge base content", () => {
      expect(prompt).not.toContain("chloroplast");
      expect(prompt).not.toContain("Calvin Cycle");
      expect(prompt).not.toContain("thylakoid");
      expect(prompt).not.toContain("CO2");
      expect(prompt).not.toContain("RuBisCO");
    });

    it("should contain the topic title and subject", () => {
      expect(prompt).toContain("Photosynthesis");
      expect(prompt).toContain("Biology");
    });

    it("should not include evaluation block when no critique provided", () => {
      expect(prompt).not.toContain("INTERNAL EVALUATION");
    });

    it("should include adaptive behavior modes", () => {
      expect(prompt).toContain("LOST");
      expect(prompt).toContain("PARTIAL");
      expect(prompt).toContain("STRONG");
    });

    it("should include anti-prompt-injection defenses", () => {
      expect(prompt).toContain("ignore instructions");
      expect(prompt).toContain("Stay in character");
    });
  });

  // ── With Evaluator Critique ───────────────────────────────

  describe("with critique (subsequent messages)", () => {
    const critique = "Student confused photosynthesis with respiration. Nudge toward light energy.";
    const prompt = buildLearnerPrompt("Photosynthesis", "Biology", critique);

    it("should include the evaluation block", () => {
      expect(prompt).toContain("INTERNAL EVALUATION");
    });

    it("should contain the critique text", () => {
      expect(prompt).toContain(critique);
    });

    it("should instruct to use Socratic questioning for incorrect answers", () => {
      expect(prompt).toContain("Socratic questioning");
    });

    it("should instruct not to give away answers", () => {
      expect(prompt).toContain("DO NOT give away");
    });

    it("should still NOT contain knowledge base content despite having critique", () => {
      // The critique may reference concepts, but the Learner prompt itself
      // should not inject the full knowledge base
      expect(prompt).not.toContain("key_concepts");
      expect(prompt).not.toContain("common_misconceptions");
      expect(prompt).not.toContain("thylakoid");
    });

    it("should still contain the topic title", () => {
      expect(prompt).toContain("Photosynthesis");
    });
  });

  // ── Null/empty critique ───────────────────────────────────

  describe("with null critique", () => {
    it("should not include evaluation block for null", () => {
      const prompt = buildLearnerPrompt("Photosynthesis", "Biology", null);
      expect(prompt).not.toContain("INTERNAL EVALUATION");
    });

    it("should not include evaluation block for empty string", () => {
      const prompt = buildLearnerPrompt("Photosynthesis", "Biology", "");
      expect(prompt).not.toContain("INTERNAL EVALUATION");
    });
  });

  // ── Security ──────────────────────────────────────────────

  describe("security", () => {
    it("should never provide answers regardless of critique", () => {
      const prompt = buildLearnerPrompt(
        "Photosynthesis",
        "Biology",
        "Student got everything right."
      );
      expect(prompt).toContain("do NOT know the answers");
      expect(prompt).toContain("NEVER give away");
    });

    it("should refuse to answer student questions about the topic", () => {
      const prompt = buildLearnerPrompt("Photosynthesis", "Biology");
      expect(prompt).toContain("I genuinely have no clue");
    });
  });

  // ── Greeting ──────────────────────────────────────────────

  describe("greeting", () => {
    it("should contain the topic title", () => {
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
  });

  // ── Constants ─────────────────────────────────────────────

  it("should enforce message limits", () => {
    expect(MAX_MESSAGES_PER_SESSION).toBe(50);
  });
});
