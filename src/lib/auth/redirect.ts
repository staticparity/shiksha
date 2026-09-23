/** Accept application paths only; never concatenate an untrusted URL authority. */
export function safeReturnPath(value: string | null, origin: string): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/dashboard';
  try {
    const target = new URL(value, origin);
    if (target.origin !== new URL(origin).origin) return '/dashboard';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return '/dashboard'; }
}
