/**
 * POST /api/mastery
 * 
 * Wisdom Agent scoring endpoint.
 * 
 * This is the ONLY place where the knowledge_base is accessed.
 * The Wisdom Agent evaluates the full transcript against ground truth
 * and returns structured mastery scoring.
 * 
 * This endpoint is called ONCE per session, when the student finishes.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import {
  buildWisdomPrompt,
  formatTranscript,
  MasteryResultSchema,
  WISDOM_MODEL,
  WISDOM_TEMPERATURE,
} from "@/lib/agents/wisdom";
import { awardCredits, updateStreak } from "@/lib/scoring/credit-engine";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { sessionId, clientTranscript } = await req.json();

    if (!sessionId) {
      return new Response("Missing sessionId", { status: 400 });
    }

    // Mark session as scoring (prevents double-scoring)
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .update({ status: "scoring" })
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .select(
        `
        id,
        transcript,
        school_id,
        started_at,
        topics (
          title,
          subject,
          knowledge_base
        )
      `
      )
      .single();

    if (sessionError || !session) {
      return Response.json(
        { error: "Session not found or already scored" },
        { status: 404 }
      );
    }

    const topic = (session as any).topics;
    let transcript = session.transcript as any[];

    // If DB transcript is empty, use the client-provided transcript as fallback
    // This handles the case where the onFinish callback in /api/chat failed silently
    if ((!transcript || transcript.length < 2) && clientTranscript && clientTranscript.length >= 2) {
      transcript = clientTranscript;

      // Also persist it to the DB for record-keeping
      await supabase
        .from("sessions")
        .update({ transcript: JSON.stringify(transcript), message_count: transcript.length })
        .eq("id", sessionId);
    }

    // Guard: don't score empty sessions
    if (!transcript || transcript.length < 2) {
      await supabase
        .from("sessions")
        .update({ status: "active" })
        .eq("id", sessionId);

      return Response.json(
        {
          error: "Not enough conversation",
          message:
            "You need to explain more before getting a score. Try teaching at least a few concepts!",
        },
        { status: 400 }
      );
    }

    // Wisdom Agent evaluation — this is the ONLY place knowledge_base is accessed
    const result = await generateObject({
      model: openai(WISDOM_MODEL),
      schema: MasteryResultSchema,
      system: buildWisdomPrompt(topic.title, topic.knowledge_base),
      prompt: `Evaluate this explanation session for the topic "${topic.title}" (${topic.subject}):\n\n${formatTranscript(transcript)}`,
      temperature: WISDOM_TEMPERATURE,
    });

    const mastery = result.object;
    const duration = Math.floor(
      (Date.now() - new Date(session.started_at).getTime()) / 1000
    );

    // Persist mastery results
    await supabase
      .from("sessions")
      .update({
        mastery_score: mastery.masteryScore,
        strengths: mastery.strengths as any,
        gaps: mastery.gaps as any,
        assessment: mastery.overallAssessment,
        recitation_detected: mastery.recitationDetected,
        follow_up_quality: mastery.followUpQuality,
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      })
      .eq("id", sessionId);

    // Award credits
    const creditsEarned = await awardCredits(
      supabase,
      user.id,
      sessionId,
      session.school_id,
      mastery.masteryScore
    );

    // Update streak
    const streakResult = await updateStreak(
      supabase,
      user.id,
      session.school_id
    );

    return Response.json({
      ...mastery,
      creditsEarned,
      currentStreak: streakResult.currentStreak,
      freezeUsed: streakResult.freezeUsed,
      durationSeconds: duration,
    });
  } catch (error) {
    console.error("[/api/mastery] Error:", error);
    return Response.json(
      { error: "Scoring failed", message: "An unexpected error occurred during scoring." },
      { status: 500 }
    );
  }
}
