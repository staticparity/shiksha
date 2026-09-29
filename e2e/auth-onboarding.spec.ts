import { test, expect } from '@playwright/test';
test.skip(!process.env.TEACHER_WORKSPACE_TEST, 'Requires isolated Auth fixtures');
const id = '00000000-0000-4000-8000-000000000700';
const user = {id,aud:'authenticated',role:'authenticated',email:'student@example.test',app_metadata:{},user_metadata:{full_name:'Rohan Gupta'}};
function session() {
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.test`,refresh_token:'test',token_type:'bearer',expires_in:3600,user};
}
test('signup waits for email confirmation and supports correcting the address', async ({page}, testInfo) => {
  await page.setViewportSize({width:390,height:844});
  let redirectTo='';
  await page.route('**/auth/v1/signup**', route => {
    redirectTo=new URL(route.request().url()).searchParams.get('redirect_to') ?? '';
    return route.fulfill({json:user});
  });
  await page.goto('/signup');
  await page.getByLabel('Full Name').fill('Rohan Gupta');
  await page.getByLabel('Email', {exact:true}).fill('student@example.test');
  await page.getByLabel('Password', {exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Create Account'}).click();
  await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('shiksha-email-confirmation-mobile.png')});
  expect(redirectTo).toBe('http://127.0.0.1:3100/callback');
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByRole('button',{name:'Use a different email'}).click();
  await expect(page.getByLabel('Email', {exact:true})).toHaveValue('student@example.test');
  await expect(page.getByLabel('Password', {exact:true})).toHaveValue('');
});
test('signup errors keep the form usable for retry', async ({page}) => {
  await page.route('**/auth/v1/signup**', route => route.fulfill({status:400,json:{code:'weak_password',msg:'Choose a stronger password.'}}));
  await page.goto('/signup');
  await page.getByLabel('Full Name').fill('Rohan Gupta');
  await page.getByLabel('Email', {exact:true}).fill('student@example.test');
  await page.getByLabel('Password', {exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Create Account'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Choose a stronger password.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Create Account'})).toBeEnabled();
  await expect(page.getByLabel('Full Name')).toHaveValue('Rohan Gupta');
});
test('sign-in returns to the requested lesson', async ({page}) => {
  await page.route('**/auth/v1/token**', route => route.fulfill({json:session()}));
  const path='/teach/00000000-0000-4000-8000-000000000020?source=resume';
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('Email', {exact:true}).fill('student@example.test');
  await page.getByLabel('Password', {exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100${path}`);
  await expect(page.getByText('Your saved conversation has been restored.')).toBeVisible();
});
test('a bad confirmation link explains how to recover', async ({page}) => {
  await page.goto('/callback');
  await expect(page.getByRole('alert').filter({hasText:'This sign-in link could not be verified.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeEnabled();
});
test('signup with an immediate session reaches the student workspace', async ({page}) => {
  await page.route('**/auth/v1/signup**', route=>route.fulfill({json:session()}));
  await page.goto('/signup');
  await page.getByLabel('Full Name').fill('Rohan Gupta');
  await page.getByLabel('Email',{exact:true}).fill('student@example.test');
  await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Create Account'}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading',{name:'Assigned Topics'})).toBeVisible();
});
