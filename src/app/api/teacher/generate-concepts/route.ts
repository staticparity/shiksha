/**
 * POST /api/teacher/generate-concepts
 *
 * Drafts key_concepts from a teacher's pasted prep material (Approach A,
 * docs/designs/ai-content-generation-from-uploads.md). A dedicated route,
 * not a 5th action on /api/teacher — keeps this call's own retry/timeout/
 * error-mocking semantics out of the otherwise pure-CRUD dispatcher there,
 * matching how /api/mastery is already split out for its one AI-generation
 * job. No shared verifyTeacher() helper: each route's inline auth check has
 * zero duplication cost on its own.
 *
 * Output is a draft for the teacher to review/edit before "Add Topic" —
 * nothing here writes to the database.
 */

import { generateObject, NoObjectGeneratedError, APICallError } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import {
  GeneratedConceptsSchema,
  buildConceptGeneratorPrompt,
  CONCEPT_GENERATOR_MODEL,
  CONCEPT_GENERATOR_TEMPERATURE,
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
} from "@/lib/agents/concept-generator";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("school_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .single();

  if (!membership) {
    return Response.json({ error: "Not a teacher" }, { status: 403 });
  }

  const { content } = (await req.json()) as { content?: string };
  const trimmed = (content ?? "").trim();

  if (trimmed.length < MIN_CONTENT_LENGTH) {
    return Response.json(
      { error: `Paste at least ${MIN_CONTENT_LENGTH} characters of content.` },
      { status: 400 }
    );
  }

  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return Response.json(
      { error: `Content must be ${MAX_CONTENT_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    const result = await generateObject({
      model: openai(CONCEPT_GENERATOR_MODEL),
      schema: GeneratedConceptsSchema,
      prompt: buildConceptGeneratorPrompt(trimmed),
      temperature: CONCEPT_GENERATOR_TEMPERATURE,
      maxRetries: 1,
      timeout: 30_000,
    });

    return Response.json(result.object);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      // Model responded but output didn't validate against the schema —
      // not transient, retrying immediately won't help without a prompt fix.
      console.error("[/api/teacher/generate-concepts] invalid schema:", {
        cause: error.cause,
        text: error.text,
      });
      return Response.json(
        {
          error: "Generation failed",
          message: "Couldn't generate concepts from that content. Try again or add them manually.",
        },
        { status: 502 }
      );
    }

    if (APICallError.isInstance(error)) {
      console.error("[/api/teacher/generate-concepts] OpenAI call failed:", {
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
      });
      return Response.json(
        {
          error: "Generation unavailable",
          message: error.isRetryable
            ? "Generation is temporarily unavailable. Try again in a moment."
            : "Something went wrong generating concepts. Try again or add them manually.",
        },
        { status: 503 }
      );
    }

    console.error("[/api/teacher/generate-concepts] unexpected error:", error);
    return Response.json(
      {
        error: "Generation failed",
        message: "Something went wrong generating concepts. Try again or add them manually.",
      },
      { status: 500 }
    );
  }
}
