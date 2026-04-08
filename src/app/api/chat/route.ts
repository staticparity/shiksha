/**
 * POST /api/chat
 * 
 * Dual-agent streaming endpoint.
 * 
 * FLOW:
 *   1. Student sends message
 *   2. Evaluator Agent (has knowledge base) scores the message → critique
 *   3. Learner Agent (has critique, NOT knowledge) responds with Socratic questioning
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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages, topicId, sessionId } = await req.json();

    if (!topicId || !sessionId) {
      return new Response("Missing topicId or sessionId", { status: 400 });
    }

    // Fetch topic metadata — title + subject for the Learner,
    // and knowledge_base for the Evaluator
    const { data: topic } = await supabase
      .from("topics")
      .select("title, subject, chapter, description, knowledge_base")
      .eq("id", topicId)
      .single();

    if (!topic) {
      return new Response("Topic not found", { status: 404 });
    }

    // Rate limiting: check message count
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

    if (session.message_count >= MAX_MESSAGES_PER_SESSION) {
      return new Response(
        JSON.stringify({
          error: "Message limit reached",
          message: `You've reached the ${MAX_MESSAGES_PER_SESSION} message limit. Finish your session to get your mastery score!`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert v6 parts-based messages to classic {role, content} format
    const normalizedMessages = (messages as any[]).map((msg: any) => {
      if (msg.content) return msg;
      const textPart = msg.parts?.find((p: any) => p.type === "text");
      return {
        role: msg.role,
        content: textPart?.text ?? "",
      };
    });

    // ── Step 1: Evaluator Agent (runs on student's latest message) ──
    // Only run evaluator after the first student message (not on greeting)
    const lastStudentMsg = normalizedMessages
      .filter((m: any) => m.role === "user")
      .pop();

    let evalCritique: string | null = null;

    if (lastStudentMsg?.content && topic.knowledge_base) {
      try {
        const evalResult = await evaluateStudentMessage(
          topic.title,
          topic.description,
          topic.knowledge_base,
          lastStudentMsg.content
        );
        evalCritique = evalResult.critique;
        console.log(
          `[Evaluator] score=${evalResult.understandingScore} critique="${evalResult.critique}"`
        );
      } catch (evalError) {
        // Evaluator failure is non-fatal — Learner works without it
        console.warn("[Evaluator] Failed, continuing without critique:", evalError);
      }
    }

    // ── Step 2: Learner Agent (gets critique, NOT knowledge base) ──
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: buildLearnerPrompt(topic.title, topic.subject, evalCritique),
      messages: normalizedMessages,
      maxOutputTokens: LEARNER_MAX_TOKENS,
      temperature: LEARNER_TEMPERATURE,
      onFinish: async ({ text, usage }) => {
        // Persist both the student message and AI response to transcript
        const lastMsg = messages[messages.length - 1];
        const studentContent = lastMsg.content
          ?? lastMsg.parts?.find((p: any) => p.type === "text")?.text
          ?? "";
        const newMessages = [
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

        // Atomic transcript append
        await supabase.rpc("append_to_transcript", {
          p_session_id: sessionId,
          p_new_messages: JSON.stringify(newMessages),
        });

        // Track token usage
        if (usage) {
          await supabase
            .from("sessions")
            .update({
              total_tokens: session.message_count > 0
                ? undefined
                : ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
            })
            .eq("id", sessionId);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[/api/chat] Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
