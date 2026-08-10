/**
 * Hand-written Supabase types, scoped to the tables T3 touches (sessions, topics).
 *
 * This is a STAND-IN for real generated types (`supabase gen types typescript`),
 * written by hand because CLI access to the live project wasn't available when
 * this was authored. It should be replaced by real codegen once Supabase CLI is
 * set up and linked — see Shiksha/TODOS.md "Generate Supabase types repo-wide".
 *
 * Keep this in sync with supabase/migrations/*.sql by hand until then. The two
 * source-of-truth files are supabase/migrations/001_initial_schema.sql (base
 * columns) and 003_two_axis_scoring.sql (the columns this file was written for).
 */

export type AxisBand = "secure" | "partial" | "prompt_dependent" | "unresolved";

export interface Misconception {
  concept: string;
  status: "active" | "corrected" | "accepted";
}

export interface Gap {
  concept: string;
  severity: "critical" | "moderate" | "minor";
  explanation: string;
}

export interface SessionRow {
  id: string;
  student_id: string;
  topic_id: string;
  class_id: string;
  school_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: unknown; // JSONB transcript array — shape owned by lib/agents/wisdom.ts's TranscriptEntry
  mastery_score: number | null;
  understanding_band: AxisBand | null;
  explanation_band: AxisBand | null;
  misconceptions: Misconception[];
  strengths: string[];
  gaps: Gap[];
  assessment: string | null;
  recitation_detected: boolean;
  follow_up_quality: "excellent" | "good" | "weak" | "evasive" | null;
  model_used: string;
  total_tokens: number;
  cost_usd: number;
  status: "active" | "completed" | "abandoned" | "scoring";
  message_count: number;
}

export interface TopicRow {
  id: string;
  class_id: string;
  title: string;
  subject: string;
  chapter: string | null;
  description: string | null;
  knowledge_base: Record<string, unknown> | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The exact field list every consumer of the `sessions` table should select
 * and write. Single source of truth — see Reviewer Concerns / eng-review
 * finding #3 in the design doc for why this exists (5+ places previously
 * hardcoded this list independently and could drift out of sync silently).
 */
export const SESSION_FIELDS_ARRAY = [
  "id",
  "mastery_score",
  "understanding_band",
  "explanation_band",
  "misconceptions",
  "strengths",
  "gaps",
  "assessment",
  "duration_seconds",
  "recitation_detected",
  "follow_up_quality",
  "status",
] as const;

export type SessionField = (typeof SESSION_FIELDS_ARRAY)[number];

/**
 * String-literal form for Supabase's typed `.select()` calls. Supabase-js
 * parses the query shape at the TYPE level from a literal string — a runtime
 * `.join()` of SESSION_FIELDS_ARRAY loses that (verified: it collapses to a
 * ParserError type). This literal must be kept in sync with the array above
 * by hand; there's no way to derive one from the other while keeping both
 * usable (iteration needs the array, `.select()` needs the literal).
 */
export const SESSION_FIELDS =
  "id,mastery_score,understanding_band,explanation_band,misconceptions,strengths,gaps,assessment,duration_seconds,recitation_detected,follow_up_quality,status" as const;
