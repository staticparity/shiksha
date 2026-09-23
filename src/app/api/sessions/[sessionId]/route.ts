import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SAVED_SESSION_FIELDS, SavedSessionSchema } from '@/lib/learning/session';

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    if (!z.uuid().safeParse(sessionId).success) return Response.json({ error: 'Invalid session' }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase.from('sessions').select(SAVED_SESSION_FIELDS)
      .eq('id', sessionId).eq('student_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json(SavedSessionSchema.parse(data), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Session recovery]', error);
    return Response.json({ error: 'Could not restore your conversation. Please try again.' }, { status: 500 });
  }
}
