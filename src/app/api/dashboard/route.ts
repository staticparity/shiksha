import { createClient } from '@/lib/supabase/server';
import { summarizeClass, type Attempt, type Topic } from '@/lib/dashboard/summary';
import { z } from 'zod';

// Page every database read so Supabase's row cap cannot silently alter statistics.
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await query(from, from + 499);
    if (result.error) throw result.error;
    const batch = (result.data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const classId = params.get('classId');
    if (!z.uuid().safeParse(classId).success) return Response.json({ error: 'A valid classId is required' }, { status: 400 });
    const { data: classInfo, error } = await supabase.from('classes').select('id, name, subject, grade, school_id')
      .eq('id', classId!).eq('teacher_id', user.id).single();
    if (error || !classInfo) return Response.json({ error: 'Class not found or unauthorized' }, { status: 403 });
    const [enrollments, topics, sessions] = await Promise.all([
      allRows<{ student_id: string; profiles: { full_name: string } | null }>((from, to) => supabase.from('class_enrollments')
        .select('student_id, profiles:student_id(full_name)').eq('class_id', classId!).order('student_id').range(from, to)),
      allRows<Topic>((from, to) => supabase.from('topics').select('id, title, subject, chapter')
        .eq('class_id', classId!).order('created_at').order('id').range(from, to)),
      allRows<Attempt>((from, to) => supabase.from('sessions').select('id, student_id, topic_id, mastery_score, ended_at, gaps, misconceptions')
        .eq('class_id', classId!).eq('status', 'completed').order('id').range(from, to)),
    ]);
    const summary = summarizeClass(enrollments.map(e => ({ id: e.student_id, name: e.profiles?.full_name ?? 'Student' })), topics, sessions);
    return Response.json({ classInfo, topics, ...summary }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Dashboard]', error);
    return Response.json({ error: 'Could not load class progress. Please try again.' }, { status: 500 });
  }
}
