import type { createClient } from '@/lib/supabase/server';
type Client = Awaited<ReturnType<typeof createClient>>;
export interface ProgressAttempt { id: string; topic_id: string; mastery_score: number | null; ended_at: string | null }
export interface TopicProgress { bestScore: number | null; latestScore: number | null; lastAttempt: string | null }
export function summarizeProgress(attempts: ProgressAttempt[]): Map<string, TopicProgress> {
  const progress = new Map<string, TopicProgress>();
  const latestIds = new Map<string, string>();
  for (const attempt of attempts) {
    const previous = progress.get(attempt.topic_id) ?? { bestScore: null, latestScore: null, lastAttempt: null };
    const bestScore = attempt.mastery_score === null ? previous.bestScore
      : Math.max(previous.bestScore ?? attempt.mastery_score, attempt.mastery_score);
    const newer = attempt.ended_at !== null && (previous.lastAttempt === null ||
      Date.parse(attempt.ended_at) > Date.parse(previous.lastAttempt) ||
      (Date.parse(attempt.ended_at) === Date.parse(previous.lastAttempt) && attempt.id > (latestIds.get(attempt.topic_id) ?? '')));
    progress.set(attempt.topic_id, { bestScore,
      latestScore: newer ? attempt.mastery_score : previous.latestScore,
      lastAttempt: newer ? attempt.ended_at : previous.lastAttempt });
    if (newer) latestIds.set(attempt.topic_id, attempt.id);
  }
  return progress;
}
export async function loadStudentProgress(supabase: Client, studentId: string) {
  const attempts: ProgressAttempt[] = [];
  // Bound each fetch and paginate beyond Supabase's response cap; query count
  // grows with attempts, rather than issuing a request for every topic card.
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('sessions')
      .select('id, topic_id, mastery_score, ended_at').eq('student_id', studentId).eq('status', 'completed')
      .order('id').range(from, from + 499);
    if (error) throw error;
    const batch = (data ?? []) as ProgressAttempt[];
    attempts.push(...batch);
    if (batch.length < 500) return summarizeProgress(attempts);
  }
}
