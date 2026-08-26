import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoObjectGeneratedError, APICallError } from "ai";

const generateObjectMock = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: (...args: unknown[]) => generateObjectMock(...args) };
});

function mockSupabase(opts: { user?: { id: string } | null; role?: string | null }) {
  const { user = { id: "teacher-1" }, role = "teacher" } = opts;
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() =>
      Promise.resolve({
        auth: { getUser: vi.fn(() => Promise.resolve({ data: { user } })) },
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({ data: role ? { role } : null }),
              }),
            }),
          }),
        })),
      })
    ),
  }));
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/teacher/generate-concepts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const LONG_CONTENT =
  "Chlorophyll absorbs light energy in the thylakoid membrane, driving the light-dependent reactions that split water and generate ATP and NADPH for the Calvin cycle.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/teacher/generate-concepts", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: LONG_CONTENT }));
    expect(res.status).toBe(401);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller isn't a teacher", async () => {
    mockSupabase({ role: null });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: LONG_CONTENT }));
    expect(res.status).toBe(403);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("returns 400 when content is below the minimum length, without calling the model", async () => {
    mockSupabase({});
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: "too short" }));
    expect(res.status).toBe(400);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("returns 400 when content exceeds the maximum length", async () => {
    mockSupabase({});
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: "a".repeat(8001) }));
    expect(res.status).toBe(400);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("returns the generated concepts on success", async () => {
    mockSupabase({});
    const concepts = {
      key_concepts: [
        { concept: "Light reactions", description: "Splits water, generates ATP/NADPH", sourceExcerpt: "light-dependent reactions" },
      ],
    };
    generateObjectMock.mockResolvedValueOnce({ object: concepts });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: LONG_CONTENT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(concepts);
  });

  it("returns an empty list as-is when the content has nothing extractable, rather than erroring", async () => {
    mockSupabase({});
    generateObjectMock.mockResolvedValueOnce({ object: { key_concepts: [] } });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: LONG_CONTENT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ key_concepts: [] });
  });

  it("returns 502 when the model's output fails schema validation", async () => {
    mockSupabase({});
    generateObjectMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({ message: "invalid schema", text: "{bad json" })
    );
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: LONG_CONTENT }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Generation failed");
  });

  it("returns 503 when the OpenAI call fails", async () => {
    mockSupabase({});
    generateObjectMock.mockRejectedValueOnce(
      new APICallError({
        message: "rate limited",
        url: "https://api.openai.com",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      })
    );
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ content: LONG_CONTENT }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("Generation unavailable");
  });

  it("passes maxRetries and timeout through to generateObject per the design doc", async () => {
    mockSupabase({});
    generateObjectMock.mockResolvedValueOnce({ object: { key_concepts: [] } });
    const { POST } = await import("./route");

    await POST(makeRequest({ content: LONG_CONTENT }));

    expect(generateObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 1, timeout: 30_000 })
    );
  });
});
