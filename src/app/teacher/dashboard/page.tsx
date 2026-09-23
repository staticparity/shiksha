import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TeacherDashboardClient } from './client';

export const dynamic = 'force-dynamic';
export default async function TeacherDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: classes, error } = await supabase.from('classes').select('id, name, subject, grade')
    .eq('teacher_id', user.id).order('created_at', { ascending: false });
  if (error) throw new Error('Could not load your classes. Please try again.');
  return <TeacherDashboardClient classes={classes ?? []} />;
}
