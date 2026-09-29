import { test, expect } from '@playwright/test';
test.skip(!process.env.TEACHER_WORKSPACE_TEST, 'Requires isolated fixture configuration');
const studentId = '00000000-0000-4000-8000-000000000700';
const topicId = '00000000-0000-4000-8000-000000000020';
const sessionId = '00000000-0000-4000-8000-000000009000';
const transcript = [
  {role:'student',content:'Plants turn light into chemical energy.'},
  {role:'learner',content:'How does the plant capture that light?',signals:{definition:true,example:false,mechanism:false,cause:false,connection:false}},
];
test.beforeEach(async ({context}) => {
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const user={id:studentId,aud:'authenticated',role:'authenticated',email:'student@example.test',app_metadata:{},user_metadata:{full_name:'Rohan Gupta'}};
  const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:studentId,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.test`;
  await context.addCookies([{name:'sb-127-auth-token',value:`base64-${encode({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})}`,domain:'127.0.0.1',path:'/'}]);
});
test('refresh resumes the saved lesson; transcript dialog contains focus and closes with Escape', async ({page})=>{
  await page.goto(`/teach/${topicId}`);
  await expect(page.getByText('How does the plant capture that light?')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Your saved conversation has been restored.')).toBeVisible();
  await expect(page.getByText('Definition',{exact:true})).toHaveAttribute('data-on','true');
  const button=page.getByRole('button',{name:'☰ Transcript'});
  await button.click();
  const dialog=page.getByRole('dialog',{name:'Your lesson with Pip'});
  await expect(dialog.getByText('Plants turn light into chemical energy.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close transcript' })).toBeFocused();
  // Native modals may Tab into browser chrome, but the underlying page is inert.
  await page.getByRole('textbox', { name: 'Type your explanation' }).evaluate(node => node.focus());
  expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
});
test('a failed reply blocks scoring and restores the unsaved explanation without resending', async ({page})=>{
  await page.route('**/api/chat', route=>route.fulfill({status:503,body:'Service unavailable'}));
  await page.goto(`/teach/${topicId}`);
  await page.getByRole('textbox',{name:'Type your explanation'}).fill('Chlorophyll absorbs light.');
  await page.getByRole('button',{name:'Send message'}).click();
  await expect(page.getByRole('button',{name:'Finish & Score'})).toBeDisabled();
  await page.getByRole('button',{name:'Restore saved conversation'}).click();
  await expect(page.getByRole('textbox',{name:'Type your explanation'})).toHaveValue('Chlorophyll absorbs light.');
  await expect(page.getByRole('button',{name:'Finish & Score'})).toBeEnabled();
});
test('a successful reply confirms teaching signals and permits scoring', async ({page}) => {
  await page.route('**/api/chat', route => route.fulfill({
    body: 'Can you give another example?',
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Pip-Signals': JSON.stringify({ definition: false, example: true, mechanism: false, cause: false, connection: false }) },
  }));
  await page.goto(`/teach/${topicId}`);
  await page.getByRole('textbox', { name: 'Type your explanation' }).fill('For example, a leaf uses sunlight.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Can you give another example?', { exact: true })).toBeVisible();
  await expect(page.getByText('Example', { exact: true })).toHaveAttribute('data-on', 'true');
  await expect(page.getByText('Definition', { exact: true })).toHaveAttribute('data-on', 'true');
  const finish = page.getByRole('button', { name: 'Finish & Score' });
  await finish.click();
  const dialog = page.getByRole('dialog', { name: 'Ready to get your score?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep explaining' }).click();
  await expect(finish).toBeFocused();
});
test('recovery recognizes a committed reply and does not prepare a duplicate', async ({page})=>{
  await page.route('**/api/chat', route=>route.fulfill({status:503,body:'Connection lost'}));
  await page.route(`**/api/sessions/${sessionId}`, route=>route.fulfill({json:{id:sessionId,started_at:'2026-09-24T00:00:00Z',status:'active',transcript:[...transcript,{role:'student',content:'Chlorophyll absorbs light.'},{role:'learner',content:'What happens next?'}]}}));
  await page.goto(`/teach/${topicId}`);
  await page.getByRole('textbox',{name:'Type your explanation'}).fill('Chlorophyll absorbs light.');
  await page.getByRole('button',{name:'Send message'}).click();
  await page.getByRole('button',{name:'Restore saved conversation'}).click();
  await expect(page.getByRole('textbox',{name:'Type your explanation'})).toHaveValue('');
  await expect(page.getByText('What happens next?')).toBeVisible();
});
test('progress shows the recent result separately from the personal best',async({page})=>{
  await page.goto('/dashboard');
  const topic=page.getByRole('link').filter({has:page.getByRole('heading',{name:'Photosynthesis'})});
  await expect(topic).toContainText('35%');
  await expect(topic).toContainText('Personal best: 95%');
});
test('dashboard counts all credits and hides expired streaks in both locations', async ({page}) => {
  await page.goto('/dashboard');
  await expect(page.getByText('1003', {exact:true})).toBeVisible();
  await expect(page.getByText('+3', {exact:true})).toBeVisible();
  await expect(page.getByText('last 7 days', {exact:true})).toBeVisible();
  await expect(page.getByText('99 day streak', {exact:true})).toHaveCount(0);
  await expect(page.getByRole('banner').getByText('99', {exact:true})).toHaveCount(0);
});
test('mobile lesson fits the viewport and composition Enter does not send',async({page}, testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/teach/${topicId}`);
  const input=page.getByRole('textbox',{name:'Type your explanation'});
  await input.fill('प्रकाश');
  let sent=false;
  await page.route('**/api/chat',route=>{sent=true;return route.fulfill({status:503,body:'Unexpected send'});});
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
  await expect(input).toHaveValue('प्रकाश');
  expect(sent).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const bubble = page.getByText('How does the plant capture that light?', { exact: true });
  await bubble.evaluate(node => node.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 200; }));
  const bounds = await bubble.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await bubble.evaluate(node => node.getAnimations().forEach(animation => animation.finish()));
  await page.screenshot({path:testInfo.outputPath('shiksha-lesson-mobile.png'),fullPage:true});
});
