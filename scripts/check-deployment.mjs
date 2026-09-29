import { pathToFileURL } from 'node:url';

/** Read-only deployment checks. No student rows, SQL writes or model calls. */
export async function checkDeployment(env, request = fetch) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'];
  for (const key of keys) {
    const valid = !!env[key] && !/YOUR_|your-|test-only|\.\.\./i.test(env[key]);
    add(key, valid, valid ? 'Configured with a non-placeholder value' : 'Missing or placeholder value');
  }
  if (checks.some(c => !c.ok)) return checks;
  let base;
  try { base = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { add('Database URL', false, 'Invalid URL'); return checks; }
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) {
    add('Database URL', false, 'Use HTTPS for hosted Supabase, or HTTP on localhost'); return checks;
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    add('Server credential', false, 'The service-role and anonymous keys must differ'); return checks;
  }
  async function get(path, key, accept = 'application/json') {
    return request(new URL(path, base), { headers: { apikey:key, Authorization:`Bearer ${key}`, Accept:accept }, redirect:'error', signal:AbortSignal.timeout(15000) });
  }
  for (const [name, path] of [
    ['Auth endpoint', '/auth/v1/settings'],
    ['Session schema (migration 006)', '/rest/v1/sessions?select=request_id,lease_until,understanding_band,explanation_band,misconceptions&limit=0'],
    ['Quota schema (migration 006)', '/rest/v1/ai_quotas?select=user_id,window_started,requests&limit=0'],
  ]) {
    try {
      const response = await get(path, name === 'Auth endpoint' ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY);
      add(name, response.ok, `HTTP ${response.status}`);
    } catch { add(name, false, 'Could not connect. Check the project URL, project status and network access.'); }
  }
  try {
    const response = await get('/rest/v1/', env.SUPABASE_SERVICE_ROLE_KEY, 'application/openapi+json');
    const schema = response.ok ? await response.json() : {};
    const names = ['consume_ai_quota', 'claim_session', 'release_session', 'complete_chat', 'complete_mastery', 'enroll_verified_student'];
    const missing = names.filter(name => !schema.paths?.[`/rpc/${name}`]);
    add('Assessment and enrollment functions', response.ok && !missing.length, response.ok ? (missing.length ? `Missing: ${missing.join(', ')}` : 'All required RPCs are exposed') : `HTTP ${response.status}; cannot inspect RPCs`);
  } catch { add('Assessment and enrollment functions', false, 'Could not inspect the database API schema'); }
  try {
    const response = await get('/rest/v1/topics?select=knowledge_base&limit=0', env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    add('Anonymous answer-key restriction', [401,403].includes(response.status), `HTTP ${response.status}; expected access denied`);
  } catch { add('Anonymous answer-key restriction', false, 'Could not verify access restrictions'); }
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checks = await checkDeployment(process.env);
  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  console.log('This check does not verify email delivery, authenticated RLS, live model quality, or the deployed website. Complete the rollout smoke test in docs/deployment.md.');
  process.exitCode = checks.every(check => check.ok) ? 0 : 1;
}
