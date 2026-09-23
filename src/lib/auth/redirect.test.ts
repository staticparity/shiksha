import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './redirect';
describe('login return path', () => {
  it.each(['@evil.example', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/\n/evil.example', null])('rejects external or ambiguous redirects: %s', value => {
    expect(safeReturnPath(value, 'https://shiksha.example')).toBe('/dashboard');
  });
  it('keeps internal paths and their query strings', () => {
    expect(safeReturnPath('/teacher/setup?tab=topic#form', 'https://shiksha.example')).toBe('/teacher/setup?tab=topic#form');
  });
});
