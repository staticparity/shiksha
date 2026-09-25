import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({user:vi.fn(),owner:vi.fn(),insert:vi.fn(),saved:vi.fn(),listing:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({
  auth:{getUser:mocks.user},
  from:(table:string)=>{
    if(table === 'classes') {const q={select:()=>q,eq:()=>q,single:mocks.owner};return q;}
    return {select:()=>({order:mocks.listing}),insert:(value:unknown)=>{mocks.insert(value);return {select:()=>({single:mocks.saved})};}};
  },
})}));
vi.mock('@/lib/learning/progress',()=>({loadStudentProgress:async()=>new Map()}));
import { GET, POST } from './route';
const body={classId:'00000000-0000-4000-8000-000000000010',title:'  Plants  ',subject:'Biology'};
const request=(value:unknown)=>new Request('http://localhost/api/topics',{method:'POST',body:JSON.stringify(value)});
beforeEach(()=>{
  vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:'teacher'}}});mocks.owner.mockResolvedValue({data:{id:body.classId}});
  mocks.saved.mockResolvedValue({data:{id:'topic',title:'Plants'},error:null});mocks.listing.mockResolvedValue({data:[],error:null});
});
describe('topic API response consistency',()=>{
  it('returns JSON for both unauthenticated routes',async()=>{
    mocks.user.mockResolvedValue({data:{user:null}});
    for(const response of [await GET(),await POST(request(body))]) {expect(response.status).toBe(401);expect(await response.json()).toHaveProperty('error');}
  });
  it('rejects invalid fields and malformed JSON before inserting',async()=>{
    for(const value of [{...body,title:' '},{...body,dueDate:'tomorrow'},{...body,classId:'invalid'}]) {
      const response=await POST(request(value));expect(response.status).toBe(400);expect(await response.json()).toHaveProperty('error');
    }
    expect((await POST(new Request('http://localhost/api/topics',{method:'POST',body:'{'}))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('rejects another teacher’s class and strips unknown fields from valid writes',async()=>{
    mocks.owner.mockResolvedValueOnce({data:null});
    expect((await POST(request(body))).status).toBe(403);expect(mocks.insert).not.toHaveBeenCalled();
    expect((await POST(request({...body,teacher_id:'forged'}))).status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({title:'Plants',class_id:body.classId}));
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('teacher_id');
  });
  it('returns a recoverable JSON error for unexpected database failures',async()=>{
    mocks.saved.mockRejectedValue(new Error('private database details'));
    const response=await POST(request(body));expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error:'Could not save this topic. Please try again.'});
  });
});
