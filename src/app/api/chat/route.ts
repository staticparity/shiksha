/**
 * POST /api/chat
 *
 * Dual-agent streaming endpoint.
 *
 * FLOW:
 *   1. Student sends message
 *   2. Evaluator Agent (has knowledge base) scores the message → critique
 *   3. Learner Agent (has critique, NOT knowledge) responds via Socratic questioning
 *   4. Response streams back to student
 *
 * The student only sees the Learner's response. The Evaluator's output
 * is internal — it steers the Learner without leaking answers.
 */

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import {
  buildLearnerPrompt,
  LEARNER_MAX_TOKENS,
  LEARNER_TEMPERATURE,
  MAX_MESSAGES_PER_SESSION,
} from "@/lib/agents/learner";
import { evaluateStudentMessage } from "@/lib/agents/evaluator";

export const maxDuration = 30;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Extract text from a message regardless of format (v6 parts or classic content). */
function extractText(msg: Record<string, unknown>): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.parts)) {
    const textPart = msg.parts.find(
      (p: Record<string, unknown>) => p.type === "text"
    );
    return (textPart?.text as string) ?? "";
  }
  return "";
}

/** Normalize v6 parts-based messages to classic {role, content} for streamText. */
function normalizeMessages(
  messages: Record<string, unknown>[]
): ChatMessage[] {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: extractText(msg),
  }));
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const rawMessages = body.messages as Record<string, unknown>[];
    const topicId = body.topicId as string;
    const sessionId = body.sessionId as string;

    if (!topicId || !sessionId) {
      return new Response("Missing topicId or sessionId", { status: 400 });
    }

    // Fetch topic — title + subject for Learner, knowledge_base for Evaluator
    const { data: topic } = await supabase
      .from("topics")
      .select("title, subject, chapter, description, knowledge_base")
      .eq("id", topicId)
      .single();

    if (!topic) {
      return new Response("Topic not found", { status: 404 });
    }

    // Rate limiting
    const { data: session } = await supabase
      .from("sessions")
      .select("message_count, status")
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .single();

    if (!session) {
      return new Response("Session not found", { status: 404 });
    }

    if (session.status !== "active") {
      return new Response("Session is not active", { status: 400 });
    }

    if ((session.message_count ?? 0) >= MAX_MESSAGES_PER_SESSION) {
      return Response.json(
        {
          error: "Message limit reached",
          message: `You've reached the ${MAX_MESSAGES_PER_SESSION} message limit. Finish your session to get your mastery score!`,
        },
        { status: 429 }
      );
    }

    const messages = normalizeMessages(rawMessages);

    // ── Step 1: Evaluator Agent ─────────────────────────────────
    const lastStudentMsg = messages.filter((m) => m.role === "user").pop();
    let evalCritique: string | null = null;

    if (lastStudentMsg && topic.knowledge_base) {
      try {
        const evalResult = await evaluateStudentMessage(
          topic.title,
          topic.description,
          topic.knowledge_base,
          lastStudentMsg.content as string
        );
        evalCritique = evalResult.critique;
      } catch (evalError) {
        // Evaluator failure is non-fatal
        console.warn("[Evaluator] Failed:", evalError);
      }
    }

    // ── Step 2: Learner Agent ───────────────────────────────────
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: buildLearnerPrompt(topic.title, topic.subject, evalCritique),
      messages,
      maxOutputTokens: LEARNER_MAX_TOKENS,
      temperature: LEARNER_TEMPERATURE,
      onFinish: async ({ text, usage }) => {
        const studentContent = extractText(
          rawMessages[rawMessages.length - 1]
        );

        const newTranscriptEntries = [
          {
            role: "student" as const,
            content: studentContent,
            timestamp: new Date().toISOString(),
          },
          {
            role: "learner" as const,
            content: text,
            timestamp: new Date().toISOString(),
          },
        ];

        // Atomic transcript append + increment message count
        await supabase.rpc("append_to_transcript", {
          p_session_id: sessionId,
          p_new_messages: JSON.stringify(newTranscriptEntries),
        });

        // Accumulate token usage
        const tokensUsed =
          (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
        if (tokensUsed > 0) {
          await supabase.rpc("increment_session_tokens", {
            p_session_id: sessionId,
            p_tokens: tokensUsed,
          });
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[/api/chat] Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
