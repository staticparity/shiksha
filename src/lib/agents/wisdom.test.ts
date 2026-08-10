import { describe, it, expect } from "vitest";
import {
  buildWisdomPrompt,
  formatTranscript,
  MasteryResultSchema,
  WISDOM_MODEL,
  WISDOM_TEMPERATURE,
  AXIS_BANDS,
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

  it("instructs the model to score understanding and explanation independently", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("independent");
    expect(lower).toContain("understandingband");
    expect(lower).toContain("explanationband");
  });

  it("includes a fluent-but-wrong example to prevent axis conflation", () => {
    // The Lamarckian giraffe example is the canonical case from the source PDFs
    // for a high explanationBand paired with a low understandingBand.
    expect(prompt.toLowerCase()).toContain("giraffe");
  });

  it("includes misconception-tracking instructions with the safeguard rule", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("misconception");
    expect(lower).toContain("accepted");
    // The one-honesty-rule safeguard: an accepted misconception must be corrected.
    expect(lower).toContain("corrected before the session ends");
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
  const validBase = {
    masteryScore: 75,
    understandingBand: "secure" as const,
    explanationBand: "secure" as const,
    strengths: ["Good explanation of equation"],
    gaps: [
      {
        concept: "Calvin Cycle",
        severity: "moderate",
        explanation: "Incomplete",
      },
    ],
    misconceptions: [] as { concept: string; status: "active" | "corrected" | "accepted" }[],
    overallAssessment: "Proficient understanding overall",
    recitationDetected: false,
    followUpQuality: "good",
  };

  it("validates a correct result", () => {
    const result = MasteryResultSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects score out of range", () => {
    const result = MasteryResultSchema.safeParse({ ...validBase, masteryScore: 150 });
    expect(result.success).toBe(false);
  });

  it("rejects negative score", () => {
    const result = MasteryResultSchema.safeParse({ ...validBase, masteryScore: -10 });
    expect(result.success).toBe(false);
  });

  it("accepts every defined axis band for both axes", () => {
    for (const band of AXIS_BANDS) {
      const result = MasteryResultSchema.safeParse({
        ...validBase,
        understandingBand: band,
        explanationBand: band,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an understandingBand value outside the four-band scale", () => {
    const result = MasteryResultSchema.safeParse({
      ...validBase,
      understandingBand: "excellent",
    });
    expect(result.success).toBe(false);
  });

  it("allows understandingBand and explanationBand to diverge", () => {
    // The Session 2 case from the source PDFs: fluent delivery, wrong content.
    const result = MasteryResultSchema.safeParse({
      ...validBase,
      understandingBand: "unresolved",
      explanationBand: "secure",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a session with multiple misconceptions at different statuses", () => {
    const result = MasteryResultSchema.safeParse({
      ...validBase,
      misconceptions: [
        { concept: "Lamarckian inheritance", status: "active" },
        { concept: "Teleological framing", status: "corrected" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized misconception status", () => {
    const result = MasteryResultSchema.safeParse({
      ...validBase,
      misconceptions: [{ concept: "Lamarckian inheritance", status: "ignored" }],
    });
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
