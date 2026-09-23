import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),single:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:mocks.user},from:()=>{
  const builder={select:()=>builder,eq:(...args:unknown[])=>{mocks.eq(...args);return builder;},maybeSingle:mocks.single};return builder;
}})}));
import { GET } from './route';
const id='00000000-0000-4000-8000-000000000001';
const call=()=>GET(new Request(`http://localhost/api/sessions/${id}`),{params:Promise.resolve({sessionId:id})});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:'student'}}});mocks.single.mockResolvedValue({data:{id,started_at:'2026-09-24T00:00:00Z',status:'active',transcript:[],total_tokens:999},error:null});});
describe('session recovery authorization',()=>{
  it('requires login',async()=>{mocks.user.mockResolvedValue({data:{user:null}});expect((await call()).status).toBe(401);expect(mocks.single).not.toHaveBeenCalled();});
  it('filters by owner even when RLS grants a teacher access',async()=>{const response=await call();expect(mocks.eq).toHaveBeenCalledWith('student_id','student');expect(mocks.eq).toHaveBeenCalledWith('id',id);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(await response.json()).not.toHaveProperty('total_tokens');});
  it('does not disclose an inaccessible session',async()=>{mocks.single.mockResolvedValue({data:null,error:null});expect((await call()).status).toBe(404);});
});
