/**
 * GET /api/topics — List topics for current user
 * POST /api/topics — Create topic (teachers only)
 */

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Fetch topics with their latest session mastery scores
    const { data: topics, error } = await supabase
      .from("topics")
      .select(
        `
        id,
        title,
        subject,
        chapter,
        description,
        due_date,
        class_id,
        classes (
          name,
          subject,
          grade
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[/api/topics GET] Error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // For each topic, get the student's best session score
    const topicsWithScores = await Promise.all(
      (topics ?? []).map(async (topic) => {
        const { data: bestSession } = await supabase
          .from("sessions")
          .select("mastery_score, ended_at, status")
          .eq("topic_id", topic.id)
          .eq("student_id", user.id)
          .eq("status", "completed")
          .order("mastery_score", { ascending: false })
          .limit(1)
          .single();

        return {
          ...topic,
          bestScore: bestSession?.mastery_score ?? null,
          lastAttempt: bestSession?.ended_at ?? null,
        };
      })
    );

    return Response.json(topicsWithScores);
  } catch (error) {
    console.error("[/api/topics GET] Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
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
    const { classId, title, subject, chapter, description, knowledgeBase, dueDate } = body;

    if (!classId || !title || !subject) {
      return new Response("Missing required fields: classId, title, subject", {
        status: 400,
      });
    }

    // Verify the teacher owns this class (RLS should handle this, but explicit check)
    const { data: classData } = await supabase
      .from("classes")
      .select("id, teacher_id")
      .eq("id", classId)
      .eq("teacher_id", user.id)
      .single();

    if (!classData) {
      return new Response("Class not found or unauthorized", { status: 403 });
    }

    const { data: topic, error } = await supabase
      .from("topics")
      .insert({
        class_id: classId,
        title,
        subject,
        chapter: chapter || null,
        description: description || null,
        knowledge_base: knowledgeBase || null,
        due_date: dueDate || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[/api/topics POST] Error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(topic, { status: 201 });
  } catch (error) {
    console.error("[/api/topics POST] Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
