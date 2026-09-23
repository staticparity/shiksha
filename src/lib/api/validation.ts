import { z } from 'zod';

const message = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8000).optional(),
  parts: z.array(z.object({ type: z.literal('text'), text: z.string().max(8000) })).max(8).optional(),
});
export const ChatRequestSchema = z.object({
  topicId: z.uuid(), sessionId: z.uuid(), messages: z.array(message).min(1).max(51),
}).refine(v => v.messages.at(-1)?.role === 'user', 'The last message must be from the student');
export const MasteryRequestSchema = z.object({ sessionId: z.uuid() });
export function messageText(message: { content?: string; parts?: { text: string }[] }) {
  return (message.content ?? message.parts?.map(p => p.text).join('') ?? '').trim();
}
export async function readBody(req: Request): Promise<unknown> {
  // Enforce the limit while reading, including requests without Content-Length.
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 128_000) { await reader.cancel(); throw new Error('Request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export interface SessionLease { id: string; topic_id: string; started_at: string; transcript: Array<{ role: "student" | "learner"; content: string }> }
