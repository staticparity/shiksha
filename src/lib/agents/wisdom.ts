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

import { z } from "zod";

export const WISDOM_MODEL = "gpt-5" as const;
export const WISDOM_TEMPERATURE = 0.2;

// ── Mastery Schema ──────────────────────────────────────────

export const GapSchema = z.object({
  concept: z.string().describe("Name of the concept the student failed to explain"),
  severity: z.enum(["critical", "moderate", "minor"]).describe("How important this gap is"),
  explanation: z.string().describe("What was missing or wrong in the student's explanation"),
});

// Four-level band scale (Secure/Partial/Prompt-dependent/Unresolved), matching
// Master_Conversational_Assessment_Framework_Examiner-Student.pdf Table 4.
export const AXIS_BANDS = ["secure", "partial", "prompt_dependent", "unresolved"] as const;
export type AxisBand = (typeof AXIS_BANDS)[number];

export const MasteryResultSchema = z.object({
  masteryScore: z.number().min(0).max(100).describe("Overall mastery score from 0-100"),
  understandingBand: z
    .enum(AXIS_BANDS)
    .describe(
      "Does the student actually grasp the concept — independent of how well they can put it into words? " +
        "Score this from content correctness alone; ignore fluency, organization, and word choice entirely. " +
        "secure: the model, mechanism, and causal links are correct, with no rescue needed. " +
        "partial: mostly correct, one identifiable gap in the underlying model remains. " +
        "prompt_dependent: the correct model only emerged after a follow-up question resolved a specific gap. " +
        "unresolved: the underlying model is wrong or absent, even after follow-ups."
    ),
  explanationBand: z
    .enum(AXIS_BANDS)
    .describe(
      "Can the student communicate what they know clearly to a NOVICE audience — independent of whether the " +
        "content is correct? Score this from clarity, organization, own-words phrasing, AND audience fit; ignore " +
        "whether the content is right. Audience fit is not optional: technical, jargon-dense phrasing that a " +
        "novice could not follow is NOT secure, even if it is precise and well-organized — unpacked, novice- " +
        "legible language is required for secure. A fluent, well-organized, AUDIENCE-APPROPRIATE but WRONG " +
        "explanation scores high here and low on understandingBand — do not let one axis pull the other toward " +
        "it. secure: clear, well-sequenced, in the student's own words, and a novice with no background could " +
        "follow it without needing terms defined. partial: understandable but has structural gaps, OR leans on " +
        "unexplained jargon/technical terms a novice wouldn't know. prompt_dependent: needed a simplification or " +
        "rephrasing request to become clear to a novice. unresolved: still unclear, circular, or incoherent after " +
        "follow-ups."
    ),
  strengths: z.array(z.string()).describe("Concepts the student explained well"),
  gaps: z.array(GapSchema).describe("Knowledge gaps identified"),
  misconceptions: z
    .array(
      z.object({
        concept: z.string().describe("Which of the topic's common_misconceptions this is, verbatim"),
        status: z
          .enum(["active", "corrected", "accepted"])
          .describe(
            "active: the student holds this misconception and it was not resolved this session. " +
              "corrected: the student held it but revised their view correctly during the session, " +
              "unprompted or after a challenge. accepted: the system tested this misconception (e.g. a " +
              "naive-challenge probe) and the student agreed with a FALSE claim — this must be corrected " +
              "explicitly, never left silently wrong."
          ),
      })
    )
    .describe(
      "Only include entries for misconceptions from the topic's common_misconceptions list that this " +
        "transcript actually provides evidence about. A session can surface more than one. Empty array " +
        "if no misconception was evident either way."
    ),
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

TWO-AXIS SCORING (understandingBand and explanationBand):
Score these as two INDEPENDENT judgments. They frequently diverge, and conflating
them is the single most common mistake:
- A student can be fluent, confident, and completely WRONG. Example: "Giraffes
  stretched their necks reaching for leaves, and that got passed to their offspring."
  This is clear, well-organized, in the student's own words (explanationBand: secure)
  — and it is Lamarckian, factually backwards (understandingBand: unresolved).
- A student can have the correct model but struggle to express it. Example: technically
  precise, jargon-heavy phrasing that is accurate but incomprehensible to a novice
  (understandingBand: secure, explanationBand: partial or prompt_dependent), OR halting,
  imprecise phrasing that is nonetheless pointing at the right mechanism.
Do not let a strong score on one axis pull the other one up. Score each from its own
evidence only.

MISCONCEPTION TRACKING:
Check the transcript against the topic's common_misconceptions list (if provided).
For each one there's evidence about, report its status: "active" if the student
holds it and it wasn't resolved, "corrected" if they held it but fixed their own view
during the session, "accepted" if the system tested it directly and the student
agreed with something false — this last case is the most important to catch
accurately, since it must be corrected before the session ends, not left silently
wrong. Leave the array empty if the transcript gives no evidence either way; do not
guess.

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
