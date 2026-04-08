/**
 * POST /api/mastery
 *
 * Wisdom Agent scoring endpoint.
 *
 * This is the ONLY place where the knowledge_base is accessed for evaluation.
 * The Wisdom Agent evaluates the full transcript against ground truth
 * and returns structured mastery scoring.
 *
 * Called ONCE per session when the student finishes.
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

interface TranscriptEntry {
  role: "user" | "assistant" | "student" | "learner";
  content: string;
  timestamp?: string;
}

interface SessionTopic {
  title: string;
  subject: string;
  knowledge_base: Record<string, unknown> | null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, clientTranscript } = (await req.json()) as {
      sessionId?: string;
      clientTranscript?: TranscriptEntry[];
    };

    if (!sessionId) {
      return Response.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Mark session as scoring (prevents double-scoring)
    const { data: rawSession, error: sessionError } = await supabase
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

    if (sessionError || !rawSession) {
      return Response.json(
        { error: "Session not found or already scored" },
        { status: 404 }
      );
    }

    // Supabase returns joined relations as objects — type them properly
    const topic = (rawSession as unknown as { topics: SessionTopic }).topics;
    let transcript = rawSession.transcript as TranscriptEntry[] | null;

    // If DB transcript is empty, fall back to client-provided transcript
    if (
      (!transcript || transcript.length < 2) &&
      clientTranscript &&
      clientTranscript.length >= 2
    ) {
      transcript = clientTranscript;

      // Persist for record-keeping
      await supabase
        .from("sessions")
        .update({
          transcript: JSON.stringify(transcript),
          message_count: transcript.length,
        })
        .eq("id", sessionId);
    }

    // Guard: don't score empty sessions
    if (!transcript || transcript.length < 2) {
      // Revert to active so student can continue
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

    // Wisdom Agent evaluation
    const result = await generateObject({
      model: openai(WISDOM_MODEL),
      schema: MasteryResultSchema,
      system: buildWisdomPrompt(topic.title, topic.knowledge_base),
      prompt: `Evaluate this explanation session for the topic "${topic.title}" (${topic.subject}):\n\n${formatTranscript(transcript)}`,
      temperature: WISDOM_TEMPERATURE,
    });

    const mastery = result.object;
    const duration = Math.floor(
      (Date.now() - new Date(rawSession.started_at).getTime()) / 1000
    );

    // Persist mastery results
    await supabase
      .from("sessions")
      .update({
        mastery_score: mastery.masteryScore,
        strengths: mastery.strengths,
        gaps: mastery.gaps,
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
      rawSession.school_id,
      mastery.masteryScore
    );

    // Update streak
    const streakResult = await updateStreak(
      supabase,
      user.id,
      rawSession.school_id
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
      {
        error: "Scoring failed",
        message: "An unexpected error occurred during scoring.",
      },
      { status: 500 }
    );
  }
}
