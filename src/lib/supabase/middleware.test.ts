import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ user: vi.fn(), membership: vi.fn(), refresh: false }));
vi.mock('@supabase/ssr', () => ({ createServerClient: (_url: string, _key: string, options: {cookies:{setAll:(cookies:unknown[])=>void}}) => ({
  auth: { getUser: async () => {
    if (mocks.refresh) options.cookies.setAll([{name:'sb-refreshed',value:'new-session',options:{path:'/',httpOnly:true}}]);
    return mocks.user();
  } },
  from: () => { const query = {select:()=>query,eq:()=>query,limit:()=>query,maybeSingle:mocks.membership}; return query; },
}) }));
import { updateSession } from './middleware';
beforeEach(() => { vi.clearAllMocks(); mocks.refresh=false; mocks.user.mockResolvedValue({data:{user:null},error:null}); mocks.membership.mockResolvedValue({data:{role:'teacher'},error:null}); });
describe('workspace session routing', () => {
  it('preserves the full requested path and refreshed cookies when sign-in is needed', async () => {
    mocks.refresh=true;
    const result=await updateSession(new NextRequest('http://localhost/teach/lesson?mode=review'));
    expect(new URL(result.headers.get('location')!).searchParams.get('next')).toBe('/teach/lesson?mode=review');
    expect(result.cookies.get('sb-refreshed')?.value).toBe('new-session');
  });
  it('retains refreshed cookies on teacher redirects', async () => {
    mocks.refresh=true; mocks.user.mockResolvedValue({data:{user:{id:'teacher'}},error:null});
    const result=await updateSession(new NextRequest('http://localhost/dashboard'));
    expect(result.headers.get('location')).toBe('http://localhost/teacher/dashboard');
    expect(result.cookies.get('sb-refreshed')?.value).toBe('new-session');
  });
  it('keeps login available during an auth outage and returns JSON for APIs', async () => {
    mocks.user.mockRejectedValue(new Error('Network unavailable'));
    expect((await updateSession(new NextRequest('http://localhost/login'))).status).toBe(200);
    const response=await updateSession(new NextRequest('http://localhost/api/teacher'));
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('error');
    expect(response.headers.has('location')).toBe(false);
  });
  it('does not misroute a teacher when membership lookup fails', async () => {
    mocks.user.mockResolvedValue({data:{user:{id:'teacher'}},error:null});
    mocks.membership.mockResolvedValue({data:null,error:{message:'Database unavailable'}});
    const response=await updateSession(new NextRequest('http://localhost/teacher/dashboard'));
    expect(response.status).toBe(503);
    expect(response.headers.has('location')).toBe(false);
  });
  it('leaves API authorization to handlers without a membership lookup', async () => {
    mocks.user.mockResolvedValue({data:{user:{id:'teacher'}},error:null});
    expect((await updateSession(new NextRequest('http://localhost/api/teacher'))).status).toBe(200);
    expect(mocks.membership).not.toHaveBeenCalled();
  });
});
