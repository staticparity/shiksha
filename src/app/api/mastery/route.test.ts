import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoObjectGeneratedError, APICallError } from "ai";

// Mock the Wisdom Agent call before importing the route (route.ts calls
// generateObject at module-eval-adjacent scope inside POST, so hoisting is fine).
const generateObjectMock = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: (...args: unknown[]) => generateObjectMock(...args) };
});

// Chainable Supabase mock. `singleResult` controls the first session lookup;
// `updateError` controls whether the post-scoring write fails.
let singleResult: { data: unknown; error: unknown } = { data: null, error: null };
let updateError: unknown = null;
const updateEqCalls: Array<Record<string, unknown>> = [];

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {};
  let pendingUpdatePayload: Record<string, unknown> | null = null;
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    pendingUpdatePayload = payload;
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(singleResult));
  // When a chain ends in .eq() without .select().single() (the two writes
  // in the real route), awaiting the builder itself resolves the write.
  builder.then = (resolve: (v: { error: unknown }) => void) => {
    if (pendingUpdatePayload) updateEqCalls.push(pendingUpdatePayload);
    resolve({ error: updateError });
  };
  return builder;
}

const supabaseMock = {
  auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "student-1" } } })) },
  from: vi.fn(() => makeQueryBuilder()),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

vi.mock("@/lib/scoring/credit-engine", () => ({
  awardCredits: vi.fn(() => Promise.resolve(2)),
  updateStreak: vi.fn(() => Promise.resolve({ currentStreak: 1, freezeUsed: false })),
}));

const { POST } = await import("./route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/mastery", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/mastery — error handling split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateError = null;
    updateEqCalls.length = 0;
    singleResult = {
      data: {
        id: "session-1",
        transcript: [
          { role: "learner", content: "What is it?" },
          { role: "student", content: "It is a thing that does a thing because of reasons." },
        ],
        school_id: "school-1",
        started_at: new Date().toISOString(),
        topics: { title: "Test Topic", subject: "Science", knowledge_base: {} },
      },
      error: null,
    };
  });

  it("returns 502 with a specific message when the Wisdom Agent's output fails schema validation", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({ message: "invalid schema", text: "{bad json" })
    );

    const res = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Scoring response was invalid");
  });

  it("returns 503 with a retry message when OpenAI's API call fails and is retryable", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new APICallError({
        message: "rate limited",
        url: "https://api.openai.com",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      })
    );

    const res = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.message).toContain("temporarily unavailable");
  });

  it("returns 503 with a non-retry message when OpenAI's API call fails and is not retryable", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new APICallError({
        message: "bad request",
        url: "https://api.openai.com",
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
      })
    );

    const res = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.message).not.toContain("temporarily unavailable");
  });

  it("returns 500 and reverts the session to active when the post-scoring DB write fails silently", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        masteryScore: 75,
        understandingBand: "secure",
        explanationBand: "secure",
        strengths: [],
        gaps: [],
        misconceptions: [],
        overallAssessment: "Good.",
        recitationDetected: false,
        followUpQuality: "good",
      },
    });
    updateError = { message: "constraint violation" };

    const res = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not save your score");
    // Reverted to active — the second update call after the failed write.
    expect(updateEqCalls.some((p) => p.status === "active")).toBe(true);
  });

  it("returns 500 with a generic message for an unexpected error", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("something truly unexpected"));

    const res = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Scoring failed");
  });

  it("still succeeds and returns mastery data on the happy path", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        masteryScore: 90,
        understandingBand: "secure",
        explanationBand: "secure",
        strengths: ["Clear explanation"],
        gaps: [],
        misconceptions: [],
        overallAssessment: "Excellent.",
        recitationDetected: false,
        followUpQuality: "excellent",
      },
    });

    const res = await POST(makeRequest({ sessionId: "session-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.masteryScore).toBe(90);
    expect(body.creditsEarned).toBe(2);
  });
});
