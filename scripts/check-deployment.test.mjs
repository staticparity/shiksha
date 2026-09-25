import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDeployment } from './check-deployment.mjs';
const env = {NEXT_PUBLIC_SUPABASE_URL:'https://db.example.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon-secret',SUPABASE_SERVICE_ROLE_KEY:'service-secret',OPENAI_API_KEY:'model-secret'};
const rpcNames = ['consume_ai_quota','claim_session','release_session','complete_chat','complete_mastery','enroll_verified_student'];
const healthy = async url => new Response(JSON.stringify(url.pathname === '/rest/v1/' ? {paths:Object.fromEntries(rpcNames.map(n=>[`/rpc/${n}`,{}]))} : []), {status: url.searchParams.has('select') && url.searchParams.get('select') === 'knowledge_base' ? 403 : 200});
test('missing configuration stops before any network access', async () => {
  const checks=await checkDeployment({},()=>assert.fail('No request should be made'));
  assert.equal(checks.filter(c=>!c.ok).length,4);
});
test('healthy checks read metadata only, never follow redirects or call models', async () => {
  const checks=await checkDeployment(env,async (url,options)=>{
    assert.equal(url.origin,'https://db.example.test');
    assert.equal(options.redirect,'error');
    assert.equal(options.method,undefined);
    if (url.searchParams.has('select')) assert.equal(url.searchParams.get('limit'),'0');
    return healthy(url);
  });
  assert.equal(checks.every(c=>c.ok),true);
  assert.equal(JSON.stringify(checks).includes('service-secret'),false);
});
test('missing migration functions fail readiness', async () => {
  const checks=await checkDeployment(env,async url=>url.pathname === '/rest/v1/' ? Response.json({paths:{}}) : healthy(url));
  assert.equal(checks.find(c=>c.name === 'Assessment and enrollment functions').ok,false);
});
test('an unreachable project cannot pass access-restriction checks', async () => {
  const checks=await checkDeployment(env,async ()=>{throw new Error('network failure');});
  assert.equal(checks.find(c=>c.name === 'Anonymous answer-key restriction').ok,false);
});
test('readable answer keys and reused credentials fail readiness', async () => {
  const checks=await checkDeployment(env,async url=>url.searchParams.get('select') === 'knowledge_base' ? Response.json([]) : healthy(url));
  assert.equal(checks.find(c=>c.name === 'Anonymous answer-key restriction').ok,false);
  const credentials=await checkDeployment({...env,SUPABASE_SERVICE_ROLE_KEY:env.NEXT_PUBLIC_SUPABASE_ANON_KEY},()=>assert.fail('Must not send credentials'));
  assert.equal(credentials.at(-1).ok,false);
});
