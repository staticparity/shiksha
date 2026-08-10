import { describe, it, expect, vi, beforeEach } from "vitest";

const generateObjectMock = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: (...args: unknown[]) => generateObjectMock(...args) };
});

const { evaluateStudentMessage, EvalResultSchema, ZERO_SIGNALS } = await import("./evaluator");

const knowledgeBase = {
  key_concepts: [{ concept: "Photolysis", description: "Light splits water into H+ and O2" }],
};

describe("EvalResultSchema", () => {
  it("requires all five signal keys as booleans", () => {
    const parsed = EvalResultSchema.parse({
      understandingScore: 0.1,
      critique: "On the right track.",
      signals: {
        definition: true,
        example: false,
        mechanism: false,
        cause: true,
        connection: false,
      },
    });
    expect(parsed.signals).toEqual({
      definition: true,
      example: false,
      mechanism: false,
      cause: true,
      connection: false,
    });
  });

  it("rejects a signals object missing a key", () => {
    const result = EvalResultSchema.safeParse({
      understandingScore: 0,
      critique: "x",
      signals: { definition: true, example: false, mechanism: false, cause: false },
    });
    expect(result.success).toBe(false);
  });
});

describe("ZERO_SIGNALS", () => {
  it("is all-false — the default when the Evaluator is skipped or fails", () => {
    expect(ZERO_SIGNALS).toEqual({
      definition: false,
      example: false,
      mechanism: false,
      cause: false,
      connection: false,
    });
  });
});

describe("evaluateStudentMessage", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("instructs the model to judge signals for the latest message in isolation", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { understandingScore: 0.1, critique: "x", signals: ZERO_SIGNALS },
    });

    await evaluateStudentMessage("Photosynthesis", null, knowledgeBase, "Plants make food from light.");

    const call = generateObjectMock.mock.calls[0][0] as { system: string };
    const lower = call.system.toLowerCase();
    expect(lower).toContain("definition");
    expect(lower).toContain("example");
    expect(lower).toContain("mechanism");
    expect(lower).toContain("connection");
    expect(lower).toContain("isolation");
  });

  it("returns the signals the model produced, unmodified", async () => {
    const signals = {
      definition: true,
      example: true,
      mechanism: false,
      cause: false,
      connection: false,
    };
    generateObjectMock.mockResolvedValueOnce({
      object: { understandingScore: 0.15, critique: "Good start.", signals },
    });

    const result = await evaluateStudentMessage(
      "Photosynthesis",
      null,
      knowledgeBase,
      "Photosynthesis is when plants turn light into food, for example in leaves."
    );

    expect(result.signals).toEqual(signals);
  });
});
