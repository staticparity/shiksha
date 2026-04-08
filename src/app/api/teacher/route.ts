import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify teacher role
  const { data: membership } = await supabase
    .from("school_members")
    .select("role, school_id")
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .single();

  if (!membership) {
    return new Response("Not a teacher", { status: 403 });
  }

  const body = await req.json();

  // ── Create Class ──────────────────────────────────────────────
  if (body.action === "create_class") {
    const { name, subject, grade } = body;
    if (!name || !subject) {
      return Response.json({ error: "Name and subject are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("classes")
      .insert({
        school_id: membership.school_id,
        teacher_id: user.id,
        name,
        subject,
        grade: grade || null,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  // ── Create Topic ──────────────────────────────────────────────
  if (body.action === "create_topic") {
    const { classId, title, subject, chapter, description, knowledgeConcepts } = body;
    if (!classId || !title || !subject) {
      return Response.json({ error: "classId, title, and subject are required" }, { status: 400 });
    }

    // Verify class belongs to teacher
    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("teacher_id", user.id)
      .single();

    if (!cls) {
      return Response.json({ error: "Class not found or not yours" }, { status: 404 });
    }

    // Build knowledge_base from concepts
    const knowledge_base = knowledgeConcepts && knowledgeConcepts.length > 0
      ? {
          key_concepts: knowledgeConcepts.map((c: any) => ({
            concept: c.concept,
            description: c.description,
          })),
          common_misconceptions: [],
          difficulty_level: "intermediate",
        }
      : null;

    const { data, error } = await supabase
      .from("topics")
      .insert({
        class_id: classId,
        title,
        subject,
        chapter: chapter || null,
        description: description || null,
        knowledge_base,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  // ── Add Student to Class ──────────────────────────────────────
  if (body.action === "add_student") {
    const { classId, studentEmail } = body;
    if (!classId || !studentEmail) {
      return Response.json({ error: "classId and studentEmail are required" }, { status: 400 });
    }

    // Look up student by email using secure RPC
    const { data: student, error: lookupError } = await supabase
      .rpc("find_student_by_email", {
        p_email: studentEmail,
        p_school_id: membership.school_id,
      })
      .single() as { data: { user_id: string; full_name: string } | null; error: any };

    if (lookupError || !student) {
      return Response.json(
        { error: `No student found with email "${studentEmail}" in your school. They must sign up first.` },
        { status: 404 }
      );
    }

    // Enroll
    const { error } = await supabase
      .from("class_enrollments")
      .insert({ class_id: classId, student_id: student.user_id });

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "Student is already enrolled" }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, studentName: student.full_name });
  }

  // ── Get Teacher's Classes ─────────────────────────────────────
  if (body.action === "get_classes") {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, subject, grade")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
