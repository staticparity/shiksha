/**
 * GET /api/topics — List topics for current user
 * POST /api/topics — Create topic (teachers only)
 */

import { loadStudentProgress } from "@/lib/learning/progress";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validation";
import { z } from "zod";

const TopicSchema = z.object({
  classId: z.uuid(), title: z.string().trim().min(1).max(200), subject: z.string().trim().min(1).max(120),
  chapter: z.string().trim().max(200).optional(), description: z.string().trim().max(2000).optional(),
  knowledgeBase: z.record(z.string(), z.unknown()).nullable().optional(),
  dueDate: z.union([z.iso.date(), z.iso.datetime({ offset: true }), z.literal('')]).nullable().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
      return Response.json({ error: "Could not load topics. Please try again." }, { status: 500 });
    }

    const progress = await loadStudentProgress(supabase, user.id);
    const topicsWithScores = (topics ?? []).map(topic => ({ ...topic,
      ...(progress.get(topic.id) ?? { bestScore: null, latestScore: null, lastAttempt: null }),
    }));

    return Response.json(topicsWithScores, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error("[/api/topics GET] Error:", error);
    return Response.json({ error: "Could not load topics. Please try again." }, { status: 500 });
  }
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

    const parsed = TopicSchema.safeParse(await readBody(req).catch(() => null));
    if (!parsed.success) return Response.json({ error: "Check the topic details and try again." }, { status: 400 });
    const { classId, title, subject, chapter, description, knowledgeBase, dueDate } = parsed.data;

    // Verify the teacher owns this class (RLS should handle this, but explicit check)
    const { data: classData } = await supabase
      .from("classes")
      .select("id, teacher_id")
      .eq("id", classId)
      .eq("teacher_id", user.id)
      .single();

    if (!classData) {
      return Response.json({ error: "Class not found or unauthorized" }, { status: 403 });
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
      .select("id, title, subject, chapter, description, due_date, class_id")
      .single();

    if (error) {
      console.error("[/api/topics POST] Error:", error);
      return Response.json({ error: "Could not save this topic. Please try again." }, { status: 500 });
    }

    return Response.json(topic, { status: 201 });
  } catch (error) {
    console.error("[/api/topics POST] Error:", error);
    return Response.json({ error: "Could not save this topic. Please try again." }, { status: 500 });
  }
}
