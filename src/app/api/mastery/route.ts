import { generateObject, NoObjectGeneratedError, APICallError } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildWisdomPrompt, formatTranscript, MasteryResultSchema, WISDOM_MODEL } from '@/lib/agents/wisdom';
import { MasteryRequestSchema, readBody, type SessionLease } from '@/lib/api/validation';

export const maxDuration = 60;
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = MasteryRequestSchema.safeParse(await readBody(req).catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid sessionId' }, { status: 400 });
  const { sessionId } = parsed.data;
  const requestId = crypto.randomUUID();
  const admin = createAdminClient();
  let claimed = false;
  try {
    const quota = await admin.rpc('consume_ai_quota', { p_user_id: user.id });
    if (quota.error) throw quota.error;
    if (!quota.data) return Response.json({ message: 'Hourly request limit reached. Please try later.' }, { status: 429 });
    const { data: session, error } = await admin.rpc('claim_session', {
      p_session_id: sessionId, p_user_id: user.id, p_request_id: requestId, p_scoring: true,
    }).maybeSingle<SessionLease>();
    if (error) throw error;
    if (!session) return Response.json({ message: 'Session is busy or already scored. Wait for the current response to finish.' }, { status: 409 });
    claimed = true;
    if (!Array.isArray(session.transcript) || session.transcript.length < 2) {
      return Response.json({ message: 'Explain at least one concept before finishing your session.' }, { status: 400 });
    }
    const { data: topic, error: topicError } = await admin.from('topics').select('title, subject, knowledge_base').eq('id', session.topic_id).single();
    if (topicError || !topic) throw new Error('Could not load topic');
    const result = await generateObject({
      model: openai(WISDOM_MODEL), schema: MasteryResultSchema,
      system: buildWisdomPrompt(topic.title, topic.knowledge_base),
      prompt: `Evaluate this explanation of "${topic.title}" (${topic.subject}):\n\n${formatTranscript(session.transcript)}`,
      timeout: 45_000, maxRetries: 0,
    });
    const saved = await admin.rpc('complete_mastery', {
      p_session_id: sessionId, p_request_id: requestId, p_result: result.object,
      p_tokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    });
    if (saved.error) return Response.json({ error: 'Could not save your score', message: 'Your score could not be saved. Please try Finish & Score again.' }, { status: 500 });
    return Response.json({ ...result.object, ...saved.data,
      durationSeconds: Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)),
    });
  } catch (error) {
    console.error('[Mastery] Scoring failed', error);
    if (NoObjectGeneratedError.isInstance(error)) return Response.json({ error: 'Scoring response was invalid', message: 'We could not generate a valid score. Please try again.' }, { status: 502 });
    if (APICallError.isInstance(error)) return Response.json({ error: 'Scoring service unavailable', message: error.isRetryable ? 'Scoring is temporarily unavailable. Please try again.' : 'Scoring could not finish. Please try again shortly.' }, { status: 503 });
    return Response.json({ error: 'Scoring failed', message: 'Scoring failed. Please try again.' }, { status: 500 });
  } finally {
    if (claimed) {
      const released = await admin.rpc('release_session', { p_session_id: sessionId, p_request_id: requestId });
      if (released.error) console.error('[Mastery] Release failed; lease will expire', released.error);
    }
  }
}
