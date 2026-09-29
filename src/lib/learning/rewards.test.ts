import { describe, expect, it, vi } from 'vitest';
import { getActiveStreak, loadStudentCredits, loadStudentStreak, type StreakRecord } from './rewards';

const now = new Date('2026-09-29T18:30:00Z'); // September 30 in India
const streak: StreakRecord = { current_streak: 12, last_activity_date: '2026-09-29', streak_freezes_available: 2 };
type Client = Parameters<typeof loadStudentCredits>[0];

function query() {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn(), range: vi.fn() };
}

describe('active streak display', () => {
  it.each([
    ['2026-09-30', 0, 12],
    ['2026-09-29', 0, 12],
    ['2026-09-28', 1, 12],
    ['2026-09-28', 0, 0],
    ['2026-09-27', 2, 0],
    ['2026-10-01', 2, 0],
    [null, 2, 0],
  ])('last activity %s with %i freezes displays %i', (date, freezes, expected) => {
    expect(getActiveStreak({ ...streak, last_activity_date: date, streak_freezes_available: freezes }, now)).toBe(expected);
  });

  it('expires at midnight in India, even though the UTC day has not changed', () => {
    const withoutFreeze = { ...streak, last_activity_date: '2026-09-28', streak_freezes_available: 0 };
    expect(getActiveStreak(withoutFreeze, new Date('2026-09-29T18:29:59Z'))).toBe(12);
    expect(getActiveStreak(withoutFreeze, now)).toBe(0);
    expect(getActiveStreak(null, now)).toBe(0);
  });

  it('uses the selected school and student to load a streak', async () => {
    const membership = query();
    membership.maybeSingle.mockResolvedValue({ data: { school_id: 'school-2' }, error: null });
    const record = query();
    record.maybeSingle.mockResolvedValue({ data: streak, error: null });
    const from = vi.fn().mockReturnValueOnce(membership).mockReturnValueOnce(record);
    expect(await loadStudentStreak({ from } as unknown as Client, 'student-1', now)).toBe(12);
    expect(membership.eq).toHaveBeenCalledWith('user_id', 'student-1');
    expect(membership.order).toHaveBeenCalledWith('school_id');
    expect(record.eq.mock.calls).toEqual([['student_id', 'student-1'], ['school_id', 'school-2']]);
  });

  it('allows onboarding without a school and students without a completed session', async () => {
    const read = query();
    read.maybeSingle.mockResolvedValue({ data: null, error: null });
    const from = vi.fn(() => read);
    expect(await loadStudentStreak({ from } as unknown as Client, 'student', now)).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
    read.maybeSingle.mockResolvedValueOnce({ data: { school_id: 'school' }, error: null });
    expect(await loadStudentStreak({ from } as unknown as Client, 'student', now)).toBe(0);
  });

  it('surfaces school and streak read failures instead of silently showing zero', async () => {
    const read = query();
    read.maybeSingle.mockResolvedValue({ data: null, error: new Error('offline') });
    const client = { from: () => read } as unknown as Client;
    await expect(loadStudentStreak(client, 'student', now)).rejects.toThrow('Could not load your school');
    read.maybeSingle.mockResolvedValueOnce({ data: { school_id: 'school' }, error: null });
    await expect(loadStudentStreak(client, 'student', now)).rejects.toThrow('Could not load your streak');
  });
});

describe('student credit totals', () => {
  it('includes credits beyond the 1,000-row cap and scopes every page to the student', async () => {
    const read = query();
    const oldCredits = Array.from({ length: 500 }, () => ({ credits_earned: 1, earned_at: '2026-01-01T00:00:00Z' }));
    read.range.mockResolvedValueOnce({ data: oldCredits, error: null })
      .mockResolvedValueOnce({ data: oldCredits, error: null })
      .mockResolvedValueOnce({ data: [{ credits_earned: 3, earned_at: now.toISOString() }], error: null });
    expect(await loadStudentCredits({ from: () => read } as unknown as Client, 'student-1', now))
      .toEqual({ total: 1003, lastSevenDays: 3 });
    expect(read.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(read.eq.mock.calls).toEqual(Array.from({ length: 3 }, () => ['student_id', 'student-1']));
    expect(read.order).toHaveBeenCalledWith('id');
  });

  it('uses a rolling seven-day window with no future credits', async () => {
    const read = query();
    read.range.mockResolvedValue({ data: [
      { credits_earned: 1, earned_at: '2026-09-22T18:30:00Z' },
      { credits_earned: 2, earned_at: '2026-09-22T18:30:01Z' },
      { credits_earned: 3, earned_at: '2026-09-29T18:30:01Z' },
    ], error: null });
    expect(await loadStudentCredits({ from: () => read } as unknown as Client, 'student', now))
      .toEqual({ total: 6, lastSevenDays: 2 });
  });

  it('does not return a partial total when a later page fails', async () => {
    const read = query();
    read.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ credits_earned: 3, earned_at: now.toISOString() })), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(loadStudentCredits({ from: () => read } as unknown as Client, 'student', now))
      .rejects.toThrow('Could not load your credits');
  });
});
