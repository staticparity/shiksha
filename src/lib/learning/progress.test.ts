import { describe, expect, it, vi } from 'vitest';
import { summarizeProgress, loadStudentProgress, type ProgressAttempt } from './progress';
const attempt = (id: string, score: number, date: string): ProgressAttempt => ({ id, topic_id: 'plants', mastery_score: score, ended_at: date });
describe('student topic progress', () => {
  it('keeps the latest result and date separate from the personal best', () => {
    const summary = summarizeProgress([attempt('1', 95, '2026-09-20T00:00:00Z'), attempt('2', 35, '2026-09-23T00:00:00Z')]);
    expect(summary.get('plants')).toEqual({ bestScore: 95, latestScore: 35, lastAttempt: '2026-09-23T00:00:00Z' });
  });
  it('compares timestamps chronologically across offsets, with deterministic ties', () => {
    const attempts = [attempt('3', 30, '2026-09-23T05:00:00+05:30'), attempt('1', 80, '2026-09-23T00:00:00Z'), attempt('2', 60, '2026-09-23T00:00:00Z')];
    expect(summarizeProgress(attempts).get('plants')?.latestScore).toBe(60);
    expect(summarizeProgress(attempts.reverse()).get('plants')?.latestScore).toBe(60);
  });
  it('loads all pages and scopes the query to the current student', async () => {
    const first = Array.from({ length: 500 }, (_, i) => attempt(String(i), 80, '2026-09-20T00:00:00Z'));
    const range = vi.fn().mockResolvedValueOnce({ data:first, error:null }).mockResolvedValueOnce({ data:[attempt('501', 30, '2026-09-24T00:00:00Z')], error:null });
    const query = { select:vi.fn().mockReturnThis(), eq:vi.fn().mockReturnThis(), order:vi.fn().mockReturnThis(), range };
    const client = { from:vi.fn(() => query) } as unknown as Parameters<typeof loadStudentProgress>[0];
    const result = await loadStudentProgress(client, 'student-1');
    expect(result.get('plants')?.latestScore).toBe(30);
    expect(range.mock.calls).toEqual([[0,499],[500,999]]);
    expect(query.eq).toHaveBeenCalledWith('student_id','student-1');
    expect(query.eq).toHaveBeenCalledWith('status','completed');
  });
  it('surfaces read failures instead of displaying missing data as no attempts', async () => {
    const query = { select:vi.fn().mockReturnThis(), eq:vi.fn().mockReturnThis(), order:vi.fn().mockReturnThis(), range:vi.fn().mockResolvedValue({data:null,error:new Error('offline')}) };
    const client = {from:()=>query} as unknown as Parameters<typeof loadStudentProgress>[0];
    await expect(loadStudentProgress(client,'student')).rejects.toThrow('offline');
  });
});
