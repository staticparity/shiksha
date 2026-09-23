import { TeachingSignalsSchema, mergeSignals, ZERO_SIGNALS } from "@/lib/agents/signals";
import { z } from 'zod';
import type { UIMessage } from 'ai';

export const SavedSessionSchema = z.object({
  id: z.uuid(), started_at: z.string().datetime({ offset: true }),
  status: z.enum(['active', 'scoring', 'completed', 'abandoned']),
  transcript: z.array(z.object({ role: z.enum(['student', 'learner', 'user', 'assistant']), content: z.string(), signals: TeachingSignalsSchema.optional() })),
});
export type SavedSession = z.infer<typeof SavedSessionSchema>;
export const SAVED_SESSION_FIELDS = 'id, started_at, status, transcript';
export function sessionMessages(session: SavedSession): UIMessage[] {
  return session.transcript.map((entry, index) => ({
    id: `${session.id}-${index}`, role: entry.role === 'student' || entry.role === 'user' ? 'user' : 'assistant',
    parts: [{ type: 'text', text: entry.content }],
  }));
}

export function sessionSignals(session: SavedSession | null) {
  return session?.transcript.reduce((signals, entry) => mergeSignals(signals, entry.signals ?? {}), ZERO_SIGNALS) ?? ZERO_SIGNALS;
}
