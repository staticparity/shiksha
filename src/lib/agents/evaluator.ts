/**
 * EVALUATOR AGENT
 * 
 * Lightweight inter-turn agent that analyzes the student's latest message
 * and produces a critique + understanding score. This runs BETWEEN turns —
 * after the student sends a message but before the Learner responds.
 * 
 * The Evaluator's output is NEVER shown to the student. It's injected
 * into the Learner's system prompt so the Learner can adapt its approach.
 * 
 * This is the bridge between zero-knowledge (Learner) and full-knowledge
 * (Wisdom). The Evaluator has topic context but only outputs a steering
 * signal — never answers or corrections.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const EVALUATOR_MODEL = "gpt-4o-mini" as const;
export const EVALUATOR_TEMPERATURE = 0.3;

export const EvalResultSchema = z.object({
  understandingScore: z
    .number()
    .describe(
      "Float between -0.15 (completely wrong/giving up) to +0.3 (got it right and proved it)"
    ),
  critique: z
    .string()
    .describe(
      "Internal feedback for the teacher on whether to push harder, drop hints, or follow naturally. 1-2 sentences max."
    ),
  signals: z
    .object({
      definition: z
        .boolean()
        .describe("Student stated a clear definition — what the concept IS."),
      example: z
        .boolean()
        .describe("Student gave a concrete example, analogy, or scenario."),
      mechanism: z
        .boolean()
        .describe("Student explained HOW it works — the process or steps."),
      cause: z
        .boolean()
        .describe("Student explained WHY it happens — the underlying reason or cause."),
      connection: z
        .boolean()
        .describe("Student connected the idea to another concept, topic, or prior turn."),
    })
    .describe(
      "Which teaching components THIS message alone touches — judge only what's " +
        "present here, not the conversation so far. The caller accumulates these " +
        "across turns; a false here does not erase a true from an earlier turn."
    ),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;
export type TeachingSignals = EvalResult["signals"];

export const ZERO_SIGNALS: TeachingSignals = {
  definition: false,
  example: false,
  mechanism: false,
  cause: false,
  connection: false,
};

/**
 * Run a lightweight evaluation of the student's latest message.
 * Returns a steering signal for the Learner Agent.
 */
export async function evaluateStudentMessage(
  topicTitle: string,
  topicDescription: string | null,
  knowledgeBase: any,
  latestMessage: string
): Promise<EvalResult> {
  const conceptSummary = knowledgeBase?.key_concepts
    ?.map((c: any) => `${c.concept}: ${c.description}`)
    .join("\n")
    ?? "No specific concepts defined.";

  const result = await generateObject({
    model: openai(EVALUATOR_MODEL),
    schema: EvalResultSchema,
    system: `Analyze the student's answer regarding ${topicTitle}${topicDescription ? ` (${topicDescription})` : ""}.

KEY CONCEPTS THE STUDENT SHOULD COVER:
${conceptSummary}

Evaluate their true understanding. Are they getting closer, completely lost, or guessing?

SCORING GUIDE:
- -0.15 to -0.05: Completely wrong, giving up, disengaged, or saying "idk"
- -0.05 to 0.05: Vague, surface-level, or partially correct but missing key details
- 0.05 to 0.15: On the right track, showing developing understanding
- 0.15 to 0.25: Good understanding, covers most key points
- 0.25 to 0.30: Got it right and demonstrated deep understanding

Your critique should be 1-2 sentences of INTERNAL coaching for the tutor — what to do next. Examples:
- "Student is lost. They confused X with Y. Try nudging them toward thinking about [related concept]."
- "Partial understanding. They got the what but not the why. Push for mechanism."
- "Strong grasp. Move to edge cases or connections to other topics."
- "Student seems disengaged. Try connecting to something relatable."

Also judge which teaching components THIS message touches on (definition,
example, mechanism, cause, connection — see schema). Judge only this message
in isolation, not the conversation history. A message can touch several at
once, or none.`,
    prompt: latestMessage,
    temperature: EVALUATOR_TEMPERATURE,
  });

  return result.object;
}
