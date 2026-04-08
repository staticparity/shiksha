import { describe, it, expect } from "vitest";
import {
  buildWisdomPrompt,
  formatTranscript,
  MasteryResultSchema,
  WISDOM_MODEL,
  WISDOM_TEMPERATURE,
} from "./wisdom";

describe("buildWisdomPrompt", () => {
  const knowledgeBase = {
    key_concepts: [
      {
        concept: "Photolysis",
        description: "Light splits water into H+ and O2",
      },
    ],
    common_misconceptions: ["Plants only photosynthesize during the day"],
    difficulty_level: "intermediate",
  };

  const prompt = buildWisdomPrompt("Photosynthesis", knowledgeBase);

  it("includes the topic name", () => {
    expect(prompt).toContain("Photosynthesis");
  });

  it("includes knowledge base content", () => {
    // The Wisdom Agent MUST have access to knowledge base
    expect(prompt).toContain("Photolysis");
    expect(prompt).toContain("Light splits water");
  });

  it("includes anti-gaming instructions", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toMatch(/recitation|rote|memoriz|copy|paste|textbook/);
  });

  it("includes scoring dimensions", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("coverage");
    expect(lower).toContain("accuracy");
    expect(lower).toContain("depth");
  });
});

describe("formatTranscript", () => {
  it("formats messages into readable string", () => {
    const transcript: Array<{ role: "learner" | "student"; content: string; timestamp: string }> = [
      { role: "learner", content: "What is photosynthesis?", timestamp: "2025-01-01T00:00:00Z" },
      { role: "student", content: "It is how plants make food", timestamp: "2025-01-01T00:01:00Z" },
    ];

    const result = formatTranscript(transcript);
    expect(result).toContain("LEARNER AI");
    expect(result).toContain("STUDENT");
    expect(result).toContain("What is photosynthesis?");
    expect(result).toContain("how plants make food");
  });

  it("handles empty transcript", () => {
    expect(formatTranscript([])).toBe("[Empty transcript]");
  });
});

describe("MasteryResultSchema", () => {
  it("validates a correct result", () => {
    const valid = {
      masteryScore: 75,
      strengths: ["Good explanation of equation"],
      gaps: [
        {
          concept: "Calvin Cycle",
          severity: "moderate",
          explanation: "Incomplete",
        },
      ],
      overallAssessment: "Proficient understanding overall",
      recitationDetected: false,
      followUpQuality: "good",
    };

    const result = MasteryResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects score out of range", () => {
    const invalid = {
      masteryScore: 150,
      strengths: [],
      gaps: [],
      overallAssessment: "Test",
      recitationDetected: false,
      followUpQuality: "good",
    };

    const result = MasteryResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects negative score", () => {
    const invalid = {
      masteryScore: -10,
      strengths: [],
      gaps: [],
      overallAssessment: "Test",
      recitationDetected: false,
      followUpQuality: "good",
    };

    const result = MasteryResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("constants", () => {
  it("uses a capable model", () => {
    expect(WISDOM_MODEL).toContain("gpt-4");
  });

  it("has low temperature for consistent scoring", () => {
    expect(WISDOM_TEMPERATURE).toBeLessThanOrEqual(0.5);
  });
});
