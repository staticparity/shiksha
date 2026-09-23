import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APICallError, NoObjectGeneratedError } from 'ai';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), rpc: vi.fn(), user: vi.fn(), topic: vi.fn() }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateObject: mocks.generate }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ single: mocks.topic }) }) }),
}) }));
import { POST } from './route';
const sessionId = '00000000-0000-4000-8000-000000000001';
const transcript = [{ role: 'student', content: 'Plants capture light energy.' }, { role: 'learner', content: 'How does that work?' }];
const result = { masteryScore: 75, understandingBand: 'partial', explanationBand: 'partial', strengths: [], gaps: [], misconceptions: [], overallAssessment: 'Good', recitationDetected: false, followUpQuality: 'good' };
let session: unknown;
let writeError: unknown;
function request(body: unknown = { sessionId }) { return new Request('http://localhost/api/mastery', { method: 'POST', body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.clearAllMocks(); writeError = null;
  session = { id: sessionId, topic_id: 'topic', transcript, started_at: new Date().toISOString() };
  mocks.user.mockResolvedValue({ data: { user: { id: 'student' } } });
  mocks.topic.mockResolvedValue({ data: { title: 'Plants', subject: 'Science', knowledge_base: {} } });
  mocks.generate.mockResolvedValue({ object: result, usage: { inputTokens: 10, outputTokens: 20 } });
  mocks.rpc.mockImplementation((name: string) => {
    if (name === 'claim_session') return { maybeSingle: async () => ({ data: session, error: null }) };
    if (name === 'consume_ai_quota') return Promise.resolve({ data: true, error: null });
    if (name === 'complete_mastery') return Promise.resolve({ data: { creditsEarned: 2 }, error: writeError });
    return Promise.resolve({ error: null });
  });
});
describe('authoritative scoring', () => {
  it('requires authentication and valid IDs before privileged calls', async () => {
    expect((await POST(request({ sessionId: 'invalid' }))).status).toBe(400);
    mocks.user.mockResolvedValue({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('never accepts a fabricated client transcript as a fallback', async () => {
    session = { transcript: [] };
    expect((await POST(request({ sessionId, clientTranscript: transcript }))).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('release_session', expect.anything());
  });
  it('does not score busy, foreign or completed sessions', async () => {
    session = null;
    expect((await POST(request())).status).toBe(409);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([
    [new Error('failure'), 500],
    [new NoObjectGeneratedError({ response: { id: 'test', modelId: 'test', timestamp: new Date() }, finishReason: 'error', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, outputTokenDetails: { textTokens: 0, reasoningTokens: 0 } }, message: 'bad output', text: '{}' }), 502],
    [new APICallError({ message: 'busy', url: 'https://api.openai.com', requestBodyValues: {}, statusCode: 429, isRetryable: true }), 503],
  ])('releases scoring lease after model errors', async (error, status) => {
    mocks.generate.mockRejectedValueOnce(error);
    expect((await POST(request())).status).toBe(status);
    expect(mocks.rpc).toHaveBeenCalledWith('release_session', expect.objectContaining({ p_session_id: sessionId }));
  });
  it('releases lease after a failed atomic completion', async () => {
    writeError = { message: 'DB unavailable' };
    expect((await POST(request())).status).toBe(500);
    expect(mocks.rpc).toHaveBeenCalledWith('release_session', expect.anything());
  });
  it('persists score and token usage through atomic completion', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ masteryScore: 75, creditsEarned: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith('complete_mastery', expect.objectContaining({ p_result: result, p_tokens: 30 }));
  });
});
