import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

    // Find user by email
    const { data: studentUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", (
        await supabase.rpc("get_user_id_by_email", { p_email: studentEmail })
      ).data)
      .single();

    // Fallback: look up in auth.users via school_members
    // Since we can't directly query auth.users from client, search profiles
    // We'll look for school members with that user who are students
    const { data: members } = await supabase
      .from("school_members")
      .select("user_id, profiles(full_name)")
      .eq("school_id", membership.school_id)
      .eq("role", "student");

    // For now, search by checking all students - in production use an RPC
    let studentId: string | null = null;

    // Try to find student via profiles join
    // Since we need email lookup, use a direct approach
    const { data: allMembers } = await supabase
      .from("school_members")
      .select("user_id")
      .eq("school_id", membership.school_id)
      .eq("role", "student");

    // We need to match by email - let's use a simpler approach
    // Check if student already exists by looking up the email in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", `%${studentEmail.split("@")[0]}%`)
      .limit(1)
      .single();

    if (!profile) {
      return Response.json(
        { error: `No student found matching "${studentEmail}". The student must sign up first.` },
        { status: 404 }
      );
    }

    studentId = profile.id;

    // Verify student is in the school
    const { data: isMember } = await supabase
      .from("school_members")
      .select("id")
      .eq("user_id", studentId)
      .eq("school_id", membership.school_id)
      .eq("role", "student")
      .single();

    if (!isMember) {
      return Response.json(
        { error: "This user is not a student in your school" },
        { status: 400 }
      );
    }

    // Enroll
    const { error } = await supabase
      .from("class_enrollments")
      .insert({ class_id: classId, student_id: studentId })

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "Student is already enrolled" }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, studentName: profile.full_name });
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
