/**
 * Credit & Streak Engine
 * 
 * Handles gamification: mastery credits, streaks, streak freezes.
 * Designed as pure functions that take a Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCredits } from "./mastery-calculator";

// ── Streak Logic ────────────────────────────────────────────

/**
 * Update a student's streak after completing a session.
 * 
 * Logic:
 * - If last activity was today: no change (already counted)
 * - If last activity was yesterday: increment streak
 * - If last activity was 2+ days ago:
 *   - If streak freeze available: use it, keep streak, increment
 *   - Else: reset streak to 1
 */
export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  schoolId: string
): Promise<{ currentStreak: number; freezeUsed: boolean }> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Get or create streak record
  const { data: streak } = await supabase
    .from("streaks")
    .select("*")
    .eq("student_id", userId)
    .eq("school_id", schoolId)
    .single();

  if (!streak) {
    // First ever session - create streak
    const { data: newStreak } = await supabase
      .from("streaks")
      .insert({
        student_id: userId,
        school_id: schoolId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
        streak_freezes_available: 2,
      })
      .select()
      .single();

    return { currentStreak: newStreak?.current_streak ?? 1, freezeUsed: false };
  }

  // Already active today
  if (streak.last_activity_date === today) {
    return { currentStreak: streak.current_streak, freezeUsed: false };
  }

  const lastDate = new Date(streak.last_activity_date);
  const todayDate = new Date(today);
  const daysDiff = Math.floor(
    (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let newStreak: number;
  let freezeUsed = false;

  if (daysDiff === 1) {
    // Consecutive day - increment
    newStreak = streak.current_streak + 1;
  } else if (daysDiff === 2 && streak.streak_freezes_available > 0) {
    // Missed one day but have a freeze
    newStreak = streak.current_streak + 1;
    freezeUsed = true;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newLongest = Math.max(streak.longest_streak, newStreak);

  await supabase
    .from("streaks")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_activity_date: today,
      ...(freezeUsed
        ? { streak_freezes_available: streak.streak_freezes_available - 1 }
        : {}),
    })
    .eq("id", streak.id);

  return { currentStreak: newStreak, freezeUsed };
}

/**
 * Get total mastery credits for a student.
 */
export async function getTotalCredits(
  supabase: SupabaseClient,
  userId: string,
  schoolId: string
): Promise<{ total: number; thisWeek: number }> {
  const { data: allCredits } = await supabase
    .from("mastery_credits")
    .select("credits_earned, earned_at")
    .eq("student_id", userId)
    .eq("school_id", schoolId);

  if (!allCredits) return { total: 0, thisWeek: 0 };

  const total = allCredits.reduce((sum, c) => sum + c.credits_earned, 0);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const thisWeek = allCredits
    .filter((c) => new Date(c.earned_at) > oneWeekAgo)
    .reduce((sum, c) => sum + c.credits_earned, 0);

  return { total, thisWeek };
}

/**
 * Award credits for a completed session.
 */
export async function awardCredits(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  schoolId: string,
  masteryScore: number
): Promise<number> {
  const credits = calculateCredits(masteryScore);

  if (credits > 0) {
    await supabase.from("mastery_credits").insert({
      student_id: userId,
      session_id: sessionId,
      school_id: schoolId,
      credits_earned: credits,
    });
  }

  return credits;
}
