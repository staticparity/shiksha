import { z } from 'zod';
export const TeachingSignalsSchema = z.object({
  definition: z.boolean(), example: z.boolean(), mechanism: z.boolean(), cause: z.boolean(), connection: z.boolean(),
});
export type TeachingSignals = z.infer<typeof TeachingSignalsSchema>;
export const ZERO_SIGNALS: TeachingSignals = { definition: false, example: false, mechanism: false, cause: false, connection: false };
export function mergeSignals(previous: TeachingSignals, next: Partial<TeachingSignals>): TeachingSignals {
  return {
    definition: previous.definition || next.definition === true,
    example: previous.example || next.example === true,
    mechanism: previous.mechanism || next.mechanism === true,
    cause: previous.cause || next.cause === true,
    connection: previous.connection || next.connection === true,
  };
}
