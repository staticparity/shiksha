/**
 * WISDOM AGENT
 * 
 * The backend-only evaluator that sees EVERYTHING.
 * This agent is NEVER exposed to students.
 * 
 * It receives:
 * - The full conversation transcript
 * - The topic's knowledge base (answer key)
 * - Anti-gaming instructions
 * 
 * It returns structured mastery scoring.
 */

import { z } from "zod/v4";

export const WISDOM_MODEL = "gpt-4o" as const;
export const WISDOM_TEMPERATURE = 0.2;

// ── Mastery Schema ──────────────────────────────────────────

export const GapSchema = z.object({
  concept: z.string().describe("Name of the concept the student failed to explain"),
  severity: z.enum(["critical", "moderate", "minor"]).describe("How important this gap is"),
  explanation: z.string().describe("What was missing or wrong in the student's explanation"),
});

export const MasteryResultSchema = z.object({
  masteryScore: z.number().min(0).max(100).describe("Overall mastery score from 0-100"),
  strengths: z.array(z.string()).describe("Concepts the student explained well"),
  gaps: z.array(GapSchema).describe("Knowledge gaps identified"),
  overallAssessment: z.string().describe("1-2 sentence summary of the student's understanding"),
  recitationDetected: z.boolean().describe("Whether the student appeared to copy-paste rather than explain in their own words"),
  followUpQuality: z.enum(["excellent", "good", "weak", "evasive"]).describe("How well the student handled follow-up questions"),
});

export type MasteryResult = z.infer<typeof MasteryResultSchema>;
export type Gap = z.infer<typeof GapSchema>;

// ── Wisdom Prompt Builder ───────────────────────────────────

export function buildWisdomPrompt(
  topicTitle: string,
  knowledgeBase: Record<string, unknown> | null
): string {
  const kbSection = knowledgeBase
    ? `\n\nKNOWLEDGE BASE (ground truth for scoring):\n${JSON.stringify(knowledgeBase, null, 2)}`
    : "";

  return `You are an expert evaluator analyzing a student's attempt to explain "${topicTitle}". You have complete, authoritative knowledge of the subject.
${kbSection}

EVALUATION FRAMEWORK:
Given the conversation transcript between the student (who was teaching) and the Learner AI (who was asking questions), evaluate the student across four dimensions:

1. COVERAGE (0-25 points): Which key concepts were explained? Which were missed entirely?
   - Every concept in the knowledge base should ideally be addressed
   - Partial coverage = partial points
   - Missing a critical concept = significant deduction

2. ACCURACY (0-25 points): Were the explanations factually correct?
   - Major factual errors = heavy penalty
   - Minor inaccuracies or imprecise language = moderate penalty
   - Correct but oversimplified = slight penalty

3. DEPTH (0-25 points): Did the student explain MECHANISMS, or just restate facts?
   - "Plants use sunlight" = surface level (low depth)
   - "Chlorophyll absorbs photons which excite electrons in photosystem II, driving the electron transport chain" = mechanistic understanding (high depth)
   - The test: could someone who read only this explanation actually UNDERSTAND the topic?

4. CLARITY (0-25 points): Could a genuine beginner follow the explanation?
   - Clear logical progression = high clarity
   - Jumping between topics randomly = low clarity
   - Using jargon without defining it = reduced clarity
   - Good analogies and examples = bonus clarity

RECITATION DETECTION:
If the student's explanation reads like a textbook passage (formal tone, perfect technical vocabulary, no hesitation, no simplification, unnaturally complete), flag it as potential recitation.

Real understanding sounds conversational:
- RECITATION: "Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy."
- UNDERSTANDING: "So basically, light hits the leaf and the plant uses that energy to rearrange CO2 and water into sugar. Chlorophyll is the thing that actually captures the light."

If recitation is detected:
- Cap masteryScore at 50 maximum
- Add a gap: { concept: "Originality", severity: "critical", explanation: "Response appears copied from a textbook rather than explained in own words. Genuine understanding requires the student to rephrase concepts naturally." }
- Set recitationDetected: true

FOLLOW-UP QUALITY SCORING:
Track how the student handled the Learner AI's probing questions:
- "excellent": went deeper with mechanisms, used analogies, provided examples
- "good": answered correctly but didn't go much deeper
- "weak": restated the same information or gave vague responses
- "evasive": dodged questions, changed subject, or asked the Learner to move on

Follow-up quality modifiers:
- excellent: +10 bonus points
- good: no modifier
- weak: -10 points
- evasive: -15 points

IMPORTANT: Be strict but fair. This system exists to identify genuine understanding. A student who truly understands a topic should score 75+. A student who memorized facts but doesn't understand mechanisms should score 40-65. A student who can barely explain the topic should score below 40.

Return a structured JSON response matching the specified schema.`;
}

// ── Transcript Formatter ────────────────────────────────────

interface TranscriptMessage {
  role: "learner" | "student" | "assistant" | "user";
  content: string;
  timestamp?: string;
}

/**
 * Format a JSONB transcript array into a readable string for the Wisdom Agent.
 */
export function formatTranscript(transcript: TranscriptMessage[]): string {
  if (!transcript || transcript.length === 0) {
    return "[Empty transcript]";
  }

  return transcript
    .map((msg) => {
      const speaker =
        msg.role === "learner" || msg.role === "assistant"
          ? "LEARNER AI"
          : "STUDENT";
      return `${speaker}: ${msg.content}`;
    })
    .join("\n\n");
}
