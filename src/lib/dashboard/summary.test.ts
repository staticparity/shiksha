import { describe, expect, it } from 'vitest';
import { summarizeClass, type Attempt } from './summary';
const students = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, name: `Student ${i}` }));
const topics = [{ id: 't1', title: 'Plants' }, { id: 't2', title: 'Cells' }];
function attempt(student: string, score: number, date: string, topic = 't1'): Attempt {
  return { id: crypto.randomUUID(), student_id: student, topic_id: topic, mastery_score: score, ended_at: date, gaps: [{ concept: 'Energy' }, { concept: 'Energy' }] };
}
describe('teacher class summary', () => {
  it('uses latest attempts, including regressions, instead of best scores', () => {
    const result = summarizeClass(students, topics, [attempt('s0', 95, '2026-09-01'), attempt('s0', 30, '2026-09-02')]);
    expect(result.heatmap.find(s => s.studentId === 's0')?.avgMastery).toBe(30);
    expect(result.overview.needsSupport).toBe(1);
    expect(result.overview.studentCount).toBe(25);
  });
  it('does not treat unassessed students as zero scores', () => {
    const empty = summarizeClass(students, topics, []);
    expect(empty.overview.avgMastery).toBeNull();
    expect(empty.overview.needsSupport).toBe(0);
    expect(summarizeClass(students, topics, [attempt('s0', 80, '2026-09-02')]).overview.avgMastery).toBe(80);
  });
  it('counts each student once per gap, ignores removed students and obsolete attempts', () => {
    const attempts = students.map(s => attempt(s.id, 50, '2026-09-02'));
    attempts.push(...students.map(s => attempt(s.id, 40, '2026-09-01', 't2')));
    attempts.push(attempt('removed', 1, '2026-09-03'));
    const result = summarizeClass(students, topics, attempts);
    expect(result.alerts.find(a => a.type === 'class_wide_gap')?.message).toContain('25 of 25');
  });
  it('counts activity by India calendar date around UTC midnight', () => {
    const result = summarizeClass(students, topics, [attempt('s0', 80, '2026-09-13T20:00:00Z')], new Date('2026-09-14T01:00:00Z'));
    expect(result.overview.activeToday).toBe(1);
  });
  it('orders actual instants rather than offset strings, with deterministic ties', () => {
    const earlier = { ...attempt('s0', 95, '2026-09-24T10:00:00+05:30'), id: 'a' };
    const later = { ...attempt('s0', 30, '2026-09-24T05:00:00Z'), id: 'b' };
    const tied = { ...later, id: 'c', mastery_score: 60 };
    for (const inputs of [[earlier, later, tied], [tied, later, earlier]]) {
      const student = summarizeClass(students, topics, inputs).heatmap.find(s => s.studentId === 's0')!;
      expect(student.topicScores.t1).toBe(60);
      expect(student.sessionIds.t1).toBe('c');
      expect(student.lastActive).toBe(later.ended_at);
    }
  });
  it('scopes matching concepts by topic and uses assessed students as the denominator', () => {
    const attempts = [attempt('s0', 60, '2026-09-24'), attempt('s1', 70, '2026-09-24')];
    attempts[1].gaps = [];
    attempts.push(attempt('s2', 50, '2026-09-24', 't2'));
    const alerts = summarizeClass(students, topics, attempts).alerts.filter(a => a.type === 'class_wide_gap');
    expect(alerts).toHaveLength(2);
    expect(alerts.find(a => a.topicId === 't1')).toMatchObject({ studentIds: ['s0'], message: '1 of 2 assessed students need another look at Energy in Plants.' });
    expect(alerts.find(a => a.topicId === 't2')).toMatchObject({ studentIds: ['s2'] });
  });
  it('flags unresolved misconceptions even at high scores, excluding corrections and obsolete attempts', () => {
    const old = { ...attempt('s0', 80, '2026-09-23'), misconceptions: [{ concept: 'Plants eat soil', status: 'active' }] };
    const corrected = { ...attempt('s0', 90, '2026-09-24'), misconceptions: [{ concept: 'Plants eat soil', status: 'corrected' }] };
    const active = { ...attempt('s1', 85, '2026-09-24'), misconceptions: [{ concept: 'Plants eat soil', status: 'active' }, { concept: 'Plants eat soil', status: 'accepted' }] };
    const removed = { ...active, student_id: 'removed' };
    const result = summarizeClass(students, topics, [old, corrected, active, removed]);
    expect(result.overview.needsSupport).toBe(1);
    expect(result.alerts.find(a => a.type === 'misconception')).toMatchObject({ studentIds: ['s1'], message: '1 of 2 assessed students have an unresolved misconception in Plants: Plants eat soil.' });
    expect(result.heatmap.find(s => s.studentId === 's0')!.topicDetails.t1.misconceptions[0].status).toBe('corrected');
    expect(result.heatmap.find(s => s.studentId === 's0')!.needsSupport).toBe(false);
  });
  it('ignores malformed legacy JSON entries while preserving valid diagnostic explanations', () => {
    const saved = { ...attempt('s0', 75, '2026-09-24'), gaps: [null, {concept: 123}, {concept:'Energy', explanation:'Explain the conversion.', severity:'critical'}], misconceptions: [null, {concept:'Unknown',status:'invented'}] };
    const detail = summarizeClass(students, topics, [saved]).heatmap.find(s => s.studentId === 's0')!.topicDetails.t1;
    expect(detail.gaps).toEqual([{concept:'Energy', explanation:'Explain the conversion.',severity:'critical'}]);
    expect(detail.misconceptions).toEqual([]);
    expect(summarizeClass(students, topics, [{ ...saved, gaps: '{}', misconceptions: '{}' }]).alerts.some(a => a.type === 'class_wide_gap')).toBe(false);
  });
  it('does not round a below-threshold proportion up to 40 percent', () => {
    const roster = Array.from({length: 43}, (_, i) => ({id: `s${i}`, name: `Student ${i}`}));
    const attempts = roster.map((s, i) => ({...attempt(s.id, 70, '2026-09-24'), gaps: i < 17 ? [{concept:'Energy'}] : []}));
    expect(summarizeClass(roster, topics, attempts).alerts.some(a => a.type === 'class_wide_gap')).toBe(false);
  });
});
