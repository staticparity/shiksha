import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;
export interface StreakRecord {
  current_streak: number;
  last_activity_date: string | null;
  streak_freezes_available: number;
}

export function getActiveStreak(streak: StreakRecord | null, now = new Date()): number {
  if (!streak?.last_activity_date) return 0;
  // Match complete_mastery's calendar day and single missed-day freeze rule.
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const daysSinceActivity = (Date.parse(today) - Date.parse(streak.last_activity_date)) / 86_400_000;
  const active = daysSinceActivity === 0 || daysSinceActivity === 1 ||
    (daysSinceActivity === 2 && streak.streak_freezes_available > 0);
  return active ? streak.current_streak : 0;
}

export async function loadStudentStreak(supabase: Client, studentId: string, now = new Date()) {
  // Use the same school in the header and dashboard, including for students
  // with multiple memberships. Missing membership is normal during onboarding.
  const { data: membership, error: membershipError } = await supabase.from('school_members')
    .select('school_id').eq('user_id', studentId).order('school_id').limit(1).maybeSingle();
  if (membershipError) throw new Error('Could not load your school.', { cause: membershipError });
  if (!membership) return 0;

  const { data: streak, error } = await supabase.from('streaks')
    .select('current_streak, last_activity_date, streak_freezes_available')
    .eq('student_id', studentId).eq('school_id', membership.school_id).maybeSingle();
  if (error) throw new Error('Could not load your streak.', { cause: error });
  return getActiveStreak(streak, now);
}

export async function loadStudentCredits(supabase: Client, studentId: string, now = new Date()) {
  let total = 0;
  let lastSevenDays = 0;
  const cutoff = now.getTime() - 7 * 86_400_000;
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('mastery_credits')
      .select('credits_earned, earned_at').eq('student_id', studentId)
      .order('id').range(from, from + 499);
    if (error) throw new Error('Could not load your credits.', { cause: error });
    const batch = data ?? [];
    for (const credit of batch) {
      total += credit.credits_earned;
      const earnedAt = Date.parse(credit.earned_at);
      if (earnedAt > cutoff && earnedAt <= now.getTime()) lastSevenDays += credit.credits_earned;
    }
    if (batch.length < 500) return { total, lastSevenDays };
  }
}
