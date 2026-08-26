/**
 * CONCEPT GENERATOR
 *
 * Drafts `key_concepts` rows from a teacher's pasted prep material, so the
 * existing topic-creation form can be pre-filled instead of typed by hand.
 *
 * This is a review AID, not a fabrication safety net — sourceExcerpt lets a
 * teacher see roughly where a concept came from, but a grounded excerpt does
 * not prove the surrounding claim is true. The human review step before
 * "Add Topic" is the only real safety net (see
 * docs/designs/ai-content-generation-from-uploads.md).
 */

import { z } from "zod";

export const CONCEPT_GENERATOR_MODEL = "gpt-4o-mini" as const;
export const CONCEPT_GENERATOR_TEMPERATURE = 0.3;

export const MIN_CONTENT_LENGTH = 50;
export const MAX_CONTENT_LENGTH = 8000;
export const MAX_GENERATED_CONCEPTS = 8;

export const GeneratedConceptSchema = z.object({
  concept: z.string().describe('A short name for the key idea, e.g. "Role of chlorophyll"'),
  description: z
    .string()
    .describe(
      "What a correct explanation of this concept looks like — this becomes the AI's grading rubric for this concept"
    ),
  sourceExcerpt: z
    .string()
    .describe(
      "A short excerpt (a few words to one sentence) copied VERBATIM from the source content that this concept is drawn from"
    ),
});

export const GeneratedConceptsSchema = z.object({
  key_concepts: z
    .array(GeneratedConceptSchema)
    .max(MAX_GENERATED_CONCEPTS)
    .describe(
      `0-${MAX_GENERATED_CONCEPTS} key concepts extracted from the content. Return fewer if the content only ` +
        "supports fewer — never pad to reach the cap. Return an empty array if the content has nothing " +
        "substantive to extract."
    ),
});

export type GeneratedConcept = z.infer<typeof GeneratedConceptSchema>;
export type GeneratedConcepts = z.infer<typeof GeneratedConceptsSchema>;

export function buildConceptGeneratorPrompt(content: string): string {
  return `You are helping a teacher turn their own prep material into a grading rubric for a Feynman-method teach-back app. A student will later explain this topic out loud, and an AI compares their explanation against the key concepts you extract here — so each concept needs a clear, gradable description of what a correct explanation looks like.

SOURCE MATERIAL (pasted by the teacher):
"""
${content}
"""

Extract up to ${MAX_GENERATED_CONCEPTS} key concepts a student should be able to explain, based ONLY on what's actually in the material above. For each concept, return:
- "concept": a short name for the idea (a few words)
- "description": what a correct explanation looks like — specific enough to grade against, not a vague restatement of the concept name
- "sourceExcerpt": a short excerpt (a few words to one sentence) copied EXACTLY, verbatim, from the source material that this concept is drawn from

Only extract concepts that are substantively present in the material — do not invent concepts it doesn't cover, and do not pad the list to reach ${MAX_GENERATED_CONCEPTS} if it only supports fewer. If the material has no clear, teachable concepts (off-topic, too short, purely administrative), return an empty list.`;
}

function normalizeForGroundingCheck(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * True if sourceExcerpt appears (case-insensitively, whitespace/quote-
 * normalized) somewhere in content. This can only confirm a fragment of
 * text was really in the source — NOT that the concept built around it is
 * accurate. Review aid only; see file header.
 */
export function isGrounded(sourceExcerpt: string, content: string): boolean {
  const excerpt = normalizeForGroundingCheck(sourceExcerpt);
  if (!excerpt) return false;
  return normalizeForGroundingCheck(content).includes(excerpt);
}
