import { z } from 'zod';

export interface Student { id: string; name: string }
export interface Topic { id: string; title: string; subject?: string; chapter?: string | null }
export interface Attempt {
  id: string; student_id: string; topic_id: string; mastery_score: number | null;
  ended_at: string | null; gaps: unknown;
  misconceptions?: unknown;
}
const gapSchema = z.object({ concept: z.string().trim().min(1), explanation: z.string().optional(), severity: z.enum(['critical', 'moderate', 'minor']).optional() });
const misconceptionSchema = z.object({ concept: z.string().trim().min(1), status: z.enum(['active', 'accepted', 'corrected']) });
function validEntries<T>(value: unknown, schema: z.ZodType<T>): T[] {
  return (Array.isArray(value) ? value : []).flatMap(entry => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
function diagnostics(attempt: Attempt) {
  return { gaps: validEntries(attempt.gaps, gapSchema), misconceptions: validEntries(attempt.misconceptions, misconceptionSchema) };
}
export interface ClassAlert {
  id: string; type: 'low_score' | 'class_wide_gap' | 'misconception' | 'inactive';
  message: string; severity: 'critical' | 'warning' | 'info'; studentIds: string[];
  topicId?: string; concept?: string;
}
const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
export function summarizeClass(students: Student[], topics: Topic[], attempts: Attempt[], now = new Date()) {
  const currentIds = new Set(students.map(s => s.id));
  const topicIds = new Set(topics.map(t => t.id));
  const latest = new Map<string, Attempt>();
  for (const attempt of attempts) {
    if (!currentIds.has(attempt.student_id) || !topicIds.has(attempt.topic_id)) continue;
    const key = `${attempt.student_id}:${attempt.topic_id}`;
    const previous = latest.get(key);
    if (!previous || time(attempt.ended_at) > time(previous.ended_at) ||
      (time(attempt.ended_at) === time(previous.ended_at) && attempt.id > previous.id)) latest.set(key, attempt);
  }
  const heatmap = students.map(student => {
    const topicScores: Record<string, number | null> = {};
    const sessionIds: Record<string, string> = {};
    const topicDetails: Record<string, ReturnType<typeof diagnostics> & { endedAt: string | null }> = {};
    let lastActive: string | null = null;
    for (const topic of topics) {
      const attempt = latest.get(`${student.id}:${topic.id}`);
      topicScores[topic.id] = attempt?.mastery_score ?? null;
      if (attempt) {
        sessionIds[topic.id] = attempt.id;
        topicDetails[topic.id] = { ...diagnostics(attempt), endedAt: attempt.ended_at };
      }
      if (attempt?.ended_at && time(attempt.ended_at) > time(lastActive)) lastActive = attempt.ended_at;
    }
    const scores = Object.values(topicScores).filter((s): s is number => s !== null);
    return { studentId: student.id, studentName: student.name, topicScores, sessionIds, topicDetails,
      avgMastery: scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null,
      lastActive, needsSupport: scores.some(s => s < 40) || Object.values(topicDetails).some(d => d.misconceptions.some(m => m.status !== 'corrected')), attemptedTopics: scores.length };
  }).sort((a,b) => a.studentName.localeCompare(b.studentName));
  const scores = heatmap.flatMap(s => s.avgMastery === null ? [] : [s.avgMastery]);
  const dateInIndia = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  // Keep concepts scoped to a topic and count each student once. Students who
  // have not attempted this topic are not evidence for or against a diagnosis.
  const groups = new Map<string, { topicId: string; concept: string; type: 'class_wide_gap' | 'misconception'; members: Set<string> }>();
  const assessedByTopic = new Map<string, Set<string>>();
  for (const attempt of latest.values()) {
    const assessed = assessedByTopic.get(attempt.topic_id) ?? new Set<string>();
    assessed.add(attempt.student_id); assessedByTopic.set(attempt.topic_id, assessed);
    const detail = diagnostics(attempt);
    for (const item of [
      ...detail.gaps.map(g => ({ concept: g.concept, type: 'class_wide_gap' as const })),
      ...detail.misconceptions.filter(m => m.status !== 'corrected').map(m => ({ concept: m.concept, type: 'misconception' as const })),
    ]) {
      const key = JSON.stringify([attempt.topic_id, item.type, item.concept.toLowerCase()]);
      const group = groups.get(key) ?? { ...item, topicId: attempt.topic_id, members: new Set<string>() };
      group.members.add(attempt.student_id); groups.set(key, group);
    }
  }
  const alerts: ClassAlert[] = [];
  for (const [id, { concept, topicId, type, members }] of groups) {
    const total = assessedByTopic.get(topicId)!.size;
    const title = topics.find(t => t.id === topicId)!.title;
    if (members.size / total >= .4) alerts.push({ id, type, topicId, concept, severity: 'warning', studentIds: [...members].sort(),
      message: type === 'misconception'
        ? `${members.size} of ${total} assessed students have an unresolved misconception in ${title}: ${concept}.`
        : `${members.size} of ${total} assessed students need another look at ${concept} in ${title}.` });
  }
  alerts.sort((a,b) => (a.type === 'misconception' ? 0 : 1) - (b.type === 'misconception' ? 0 : 1) || b.studentIds.length - a.studentIds.length || a.id.localeCompare(b.id));
  const supportIds = heatmap.filter(s => s.needsSupport).map(s => s.studentId);
  const support = supportIds.length;
  if (support) alerts.unshift({ id: 'support', type: 'low_score', severity: 'critical', studentIds: supportIds, message: `${support} student${support === 1 ? '' : 's'} need a check-in for a low score or unresolved misconception in their latest attempts.` });
  const inactiveIds = heatmap.filter(s => !s.lastActive || now.getTime() - time(s.lastActive) > 7 * 86400000).map(s => s.studentId);
  const inactive = inactiveIds.length;
  if (inactive) alerts.push({ id: 'inactive', type: 'inactive', severity: 'info', studentIds: inactiveIds, message: `${inactive} student${inactive === 1 ? ' has' : 's have'} no completed session in the last 7 days.` });
  return { heatmap, alerts, overview: {
    studentCount: students.length, topicCount: topics.length, needsSupport: support,
    avgMastery: scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null,
    activeToday: heatmap.filter(s => s.lastActive && dateInIndia(new Date(s.lastActive)) === dateInIndia(now)).length,
    assessedStudents: scores.length,
  } };
}
