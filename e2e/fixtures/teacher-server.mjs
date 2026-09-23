import http from 'node:http';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const user = { id:id(1), aud:'authenticated', role:'authenticated', email:'ananya@example.test', app_metadata:{provider:'email'}, user_metadata:{full_name:'Ananya Sharma'}, created_at:new Date().toISOString() };
const classes = [{id:id(10),name:'8-B Biology',subject:'Biology',grade:'8',teacher_id:user.id,school_id:id(2)},{id:id(11),name:'9-A Science',subject:'Science',grade:'9',teacher_id:user.id,school_id:id(2)}];
const topics = [{id:id(20),title:'Photosynthesis',subject:'Biology',class_id:id(10)},{id:id(21),title:'Cell structure',subject:'Biology',class_id:id(10)},{id:id(22),title:'Food chains',subject:'Biology',class_id:id(10)}];
const names = ['Aanya Patel','Aarav Mehta','Diya Nair','Ishaan Rao','Kabir Shah','Meera Iyer','Myra Das','Neha Sethi','Rohan Gupta','Sana Khan','Vihaan Roy','Zoya Ali',...Array.from({length:11},(_,i)=>`Student ${i+13}`)];
const enrollments = names.map((name,i)=>({student_id:id(100+i),class_id:id(10),profiles:{full_name:name}}));
const sessions = enrollments.slice(0,19).flatMap((e,i)=>topics.map((t,j)=>({id:id(1000+i*3+j),student_id:e.student_id,topic_id:t.id,class_id:id(10),status:'completed',mastery_score:i===0?32:i===2?55:70+(i+j)%26,ended_at:new Date().toISOString(),gaps:i===0?[{concept:'Energy conversion'}]:[]})));
for (const [index, enrollment] of enrollments.slice(0, 9).entries()) {
  const session = sessions.find(s => s.student_id === enrollment.student_id && s.topic_id === id(20));
  session.misconceptions = [{concept:'Plants get their food from soil',status:index === 8 ? 'corrected' : index === 0 ? 'accepted' : 'active'}];
  if (index === 0) session.gaps = [{concept:'Energy conversion',severity:'critical',explanation:'The explanation did not connect light energy to stored chemical energy.'}];
}
const studentId = id(700);
sessions.push(
  {id:id(9001), student_id:studentId, topic_id:id(20), class_id:id(10), status:'completed', mastery_score:95, ended_at:'2026-09-20T00:00:00Z', started_at:'2026-09-20T00:00:00Z', gaps:[]},
  {id:id(9002), student_id:studentId, topic_id:id(20), class_id:id(10), status:'completed', mastery_score:35, ended_at:'2026-09-23T00:00:00Z', started_at:'2026-09-23T00:00:00Z', gaps:[]},
  {id:id(9000), student_id:studentId, topic_id:id(20), class_id:id(10), status:'active', started_at:'2026-09-24T00:00:00Z', transcript:[
    {role:'student',content:'Plants turn light into chemical energy.'},
    {role:'learner',content:'How does the plant capture that light?',signals:{definition:true,example:false,mechanism:false,cause:false,connection:false}},
  ]},
);
const server = http.createServer((req,res)=> {
  const url = new URL(req.url,'http://localhost');
  res.setHeader('Content-Type','application/json');
  let isStudent = false;
  try { isStudent = JSON.parse(Buffer.from((req.headers.authorization ?? '').split('.')[1], 'base64url').toString()).sub === studentId; } catch {}
  const currentUser = isStudent ? {...user,id:studentId,email:'student@example.test',user_metadata:{full_name:'Rohan Gupta'}} : user;
  let body;
  if(url.pathname==='/auth/v1/user') body=currentUser;
  else if(url.pathname==='/health') body={ok:true};
  else {
    const table=url.pathname.split('/').at(-1);
    let rows = table==='classes'?classes:table==='school_members'?[{role:isStudent?'student':'teacher',school_id:id(2)}]:table==='profiles'?[{id:currentUser.id,full_name:currentUser.user_metadata.full_name}]:table==='topics'?topics.map(t=>({...t,classes:{school_id:id(2),name:'8-B Biology',subject:'Biology',grade:'8'}})):table==='class_enrollments'?enrollments:table==='sessions'?sessions:[];
    for(const key of ['id','class_id','student_id','topic_id','status']) { const value=url.searchParams.get(key); if(value?.startsWith('eq.')) rows=rows.filter(r=>r[key]===value.slice(3)); }
    const order = url.searchParams.get('order');
    if (order) rows = [...rows].sort((a,b) => {
      for (const part of order.split(',')) { const [key, direction] = part.split('.'); const comparison = String(a[key] ?? '').localeCompare(String(b[key] ?? '')); if (comparison) return direction === 'desc' ? -comparison : comparison; }
      return 0;
    });
    if(url.searchParams.has('limit')) rows=rows.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0)+Number(url.searchParams.get('limit')));
    if(req.headers.accept?.includes('vnd.pgrst.object')) body=rows[0]??null;
    else body=rows;
  }
  res.end(JSON.stringify(body));
});
server.listen(54329,'127.0.0.1',()=>console.log('Isolated teacher fixtures on 54329'));
