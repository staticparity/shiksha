import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildLearnerPrompt, LEARNER_MAX_TOKENS, LEARNER_MODEL, LEARNER_TEMPERATURE } from '@/lib/agents/learner';
import { evaluateStudentMessage, ZERO_SIGNALS } from '@/lib/agents/evaluator';
import { ChatRequestSchema, messageText, readBody, type SessionLease } from '@/lib/api/validation';

export const maxDuration = 60;
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const parsed = ChatRequestSchema.safeParse(await readBody(req).catch(() => null));
  if (!parsed.success) return new Response('Invalid chat request', { status: 400 });
  const { sessionId, topicId, messages } = parsed.data;
  const content = messageText(messages.at(-1)!);
  if (!content || content.length > 8000) return new Response('Message must be 1–8000 characters', { status: 400 });
  const admin = createAdminClient();
  const requestId = crypto.randomUUID();
  let claimed = false;
  try {
    // Authorize through the user's RLS client before using privileged data.
    const { data: ownSession, error: accessError } = await supabase.from('sessions').select('id, topic_id')
      .eq('id', sessionId).eq('student_id', user.id).eq('topic_id', topicId).single();
    if (accessError || !ownSession) return new Response('Session not found', { status: 404 });
    const { data: topic, error: topicError } = await admin.from('topics').select('title, subject, description, knowledge_base').eq('id', topicId).single();
    if (topicError || !topic) throw new Error('Could not load topic');
    const quota = await admin.rpc('consume_ai_quota', { p_user_id: user.id });
    if (quota.error) throw quota.error;
    if (!quota.data) return new Response('Hourly request limit reached. Please try later.', { status: 429 });
    const { data: session, error } = await admin.rpc('claim_session', {
      p_session_id: sessionId, p_user_id: user.id, p_request_id: requestId, p_scoring: false,
    }).maybeSingle<SessionLease>();
    if (error) throw error;
    if (!session) return new Response('Session busy, finished, or message limit reached', { status: 409 });
    claimed = true;
    if (!Array.isArray(session.transcript)) throw new Error('Invalid saved transcript');
    let signals = ZERO_SIGNALS;
    let critique: string | null = null;
    let evaluatorTokens = 0;
    if (topic.knowledge_base) {
      try {
        const evaluation = await evaluateStudentMessage(topic.title, topic.description, topic.knowledge_base, content);
        signals = evaluation.signals;
        evaluatorTokens = evaluation.tokensUsed ?? 0;
        // Only fixed coaching instructions cross the evaluator/learner boundary.
        critique = evaluation.understandingScore < 0 ? 'Ask one simpler question; invite an example.'
          : evaluation.understandingScore < 0.15 ? 'Ask the student to explain the mechanism in their own words.'
          : 'Ask the student to apply their explanation to a new situation.';
      } catch (error) { console.warn('[Evaluator] Failed', error); }
    }
    const result = streamText({
      model: openai(LEARNER_MODEL), system: buildLearnerPrompt(topic.title, topic.subject, critique),
      messages: [...session.transcript.map((m: { role: string; content: string }) => ({
        role: (m.role === 'student' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content,
      })), { role: 'user', content }],
      maxOutputTokens: LEARNER_MAX_TOKENS, temperature: LEARNER_TEMPERATURE,
      timeout: 30_000, maxRetries: 1,
    });
    // Hold the stream open until persistence succeeds. A failed write errors the
    // stream, so Finish cannot silently score an unsaved turn.
    const stream = new ReadableStream({
      async start(controller) {
        let answer = '';
        try {
          for await (const chunk of result.textStream) { answer += chunk; controller.enqueue(new TextEncoder().encode(chunk)); }
          if (!answer.trim()) throw new Error('Empty learner response');
          const usage = await result.usage;
          const saved = await admin.rpc('complete_chat', {
            p_session_id: sessionId, p_request_id: requestId,
            p_messages: [{ role: 'student', content, timestamp: new Date().toISOString() },
              { role: 'learner', content: answer, signals, timestamp: new Date().toISOString() }],
            p_tokens: evaluatorTokens + (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          });
          if (saved.error || !saved.data) throw saved.error ?? new Error('Session lease expired');
          controller.close();
        } catch (error) {
          console.error('[Chat] Turn failed', error);
          controller.error(error);
        } finally {
          await admin.rpc('release_session', { p_session_id: sessionId, p_request_id: requestId });
        }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Pip-Signals': JSON.stringify(signals) } });
  } catch (error) {
    if (claimed) await admin.rpc('release_session', { p_session_id: sessionId, p_request_id: requestId });
    console.error('[Chat]', error);
    return new Response('Could not complete this turn. Please retry.', { status: 500 });
  }
}
