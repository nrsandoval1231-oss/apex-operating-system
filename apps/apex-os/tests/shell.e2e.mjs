import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createCanonicalId, civilDay } from '../../../packages/contracts/dist/index.js';
// Shell-only smoke: browser API reads are intercepted with synthetic identity/empty lists.
// This validates navigation and authentication presentation, not backend persistence.
// Owns a production Vite preview; run after building:
//   node apps/apex-os/tests/shell.e2e.mjs
// Override APEX_SHELL_URL and APEX_SCREENSHOT_DIR for another preview/artifact location.
const baseURL=(process.env.APEX_SHELL_URL ?? 'http://127.0.0.1:4195/app').replace(/\/$/,'');
const screenshotDir=process.env.APEX_SCREENSHOT_DIR ?? '/tmp/apex2/screenshots';
mkdirSync(screenshotDir,{recursive:true});
const appRoot=fileURLToPath(new URL('../',import.meta.url));
const server=process.env.APEX_SHELL_URL ? null : spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'preview','--host','127.0.0.1','--port','4195','--strictPort'],{cwd:appRoot,stdio:['ignore','pipe','pipe']});
let serverLog='';
server?.stdout.on('data',data=>serverLog+=data);
server?.stderr.on('data',data=>serverLog+=data);
let browser;
const checks=[];
try {
 if(server) {
  let ready=false;
  for(let i=0;i<100;i++) {
   if(server.exitCode!==null) throw Error(serverLog);
   try {if(serverLog.includes('Local:') && (await fetch(baseURL+'/')).ok){ready=true;break;}}catch{}
   await delay(100);
  }
  assert(ready,'Owned production preview did not start: '+serverLog);
 }
 browser=await chromium.launch({headless:true});
 for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const page=await browser.newPage({viewport,hasTouch:viewport.width<700,isMobile:viewport.width<700});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const listPaths=['/api/jobs','/api/tasks','/api/task-assignees','/api/workspace-calendar','/api/workspace-projects','/api/today','/api/today/opportunities'];
   if(path==='/api/me') return route.fulfill({json:{userId:'shell-smoke-user',displayName:'Shell Test',role:'admin'}});
   if(path==='/api/auth/config') return route.fulfill({json:{mode:'access'}});
   if(listPaths.includes(path)) return route.fulfill({json:[]});
   await route.fulfill({status:404,json:{error:'Synthetic shell fixture: resource unavailable'}});
  });
  await page.goto(`${baseURL}/today`);
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  await nav.waitFor();
  assert.deepEqual(await nav.getByRole('link').allTextContents(),['Today','Checklist','Calendar','Jobs','More']);
  assert.equal(await page.locator('.shell-brand img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  for (const label of ['Checklist','Calendar','Jobs','More','Today']) {
   await nav.getByRole('link',{name:label,exact:true}).click();
   await page.waitForTimeout(60);
   assert.equal(await nav.getByRole('link',{name:label,exact:true}).getAttribute('aria-current'),'page');
  }
  await nav.getByRole('link',{name:'More',exact:true}).click();
  for(const title of ['Designer','History','Brief']) await page.locator('.more-tools').getByRole('link',{name:new RegExp(title)}).waitFor();
  const quick=page.getByRole('button',{name:'Open quick actions'});
  if(viewport.width<700) await quick.tap(); else await quick.click();
  assert.equal(await page.locator('#quick-actions a').count(),4);
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Add Photos');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#quick-actions').count(),0);
  assert.equal(await quick.evaluate(el=>document.activeElement===el),true);
  await page.goto(`${baseURL}/projects/test-project`);
  // Head assets must resolve from the app base even on a directly loaded nested route.
  const headAssets = await page.locator('link[rel="manifest"], link[rel="apple-touch-icon"], link[rel="icon"], link[rel="mask-icon"]').evaluateAll(links => links.map(link => ({rel: link.rel, href: link.href})));
  for (const asset of headAssets) {
   const expected = asset.rel === 'manifest' ? 'manifest.webmanifest' : asset.rel === 'apple-touch-icon' ? 'brand/apex-icon-180.png' : 'favicon.svg';
   assert.equal(asset.href, `${baseURL}/${expected}`, `${asset.rel} must resolve from app base`);
   const response = await page.request.get(asset.href);
   assert.equal(response.status(), 200);
   if (asset.rel === 'manifest') {
    assert.match(response.headers()['content-type'], /(?:manifest\+json|application\/json)/);
    const manifest = await response.json();
    assert.equal(new URL(manifest.start_url, asset.href).href, `${baseURL}/today`);
    for (const icon of manifest.icons) {
     const iconResponse = await page.request.get(new URL(icon.src, asset.href).href);
     assert.equal(iconResponse.status(), 200);
     assert.match(iconResponse.headers()['content-type'], /image\/png/);
     assert.equal((await iconResponse.body()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
   } else if (asset.rel === 'apple-touch-icon') {
    assert.match(response.headers()['content-type'], /image\/png/);
    assert.equal((await response.body()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
   } else {
    assert.match(response.headers()['content-type'], /image\/svg\+xml/);
    assert.match(await response.text(), /<svg/);
   }
  }
  await page.getByRole('button',{name:'Open quick actions'}).click();
  const task=page.getByRole('link',{name:'Add Task',exact:true});
  assert.equal(await task.getAttribute('href'),'/app/checklist?action=add-task&project=test-project');
  await task.click();
  assert.match(page.url(),/checklist\?action=add-task&project=test-project$/);
  await page.getByRole('button',{name:'Open quick actions'}).click();
  assert.equal(await page.getByRole('link',{name:'Schedule Event',exact:true}).getAttribute('href'),'/app/calendar?action=schedule-event&project=test-project');
  await page.keyboard.press('Escape');
  await page.goto(`${baseURL}/more`);await nav.waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  if(viewport.width===390) {
   const n=await nav.boundingBox();const q=await page.getByRole('button',{name:'Open quick actions'}).boundingBox();
   assert(q.y+q.height<n.y,'Quick action must stay above all five destinations');
   for(const link of await nav.getByRole('link').all()){const b=await link.boundingBox();assert(b.width>=44&&b.height>=44);}
  }
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(await page.getByText('The Apex API returned data this build does not understand.',{exact:false}).count(),0,'fixture contracts match production reads');
  await page.screenshot({path:`${screenshotDir}/shell-${viewport.width}.png`,fullPage:false});
  checks.push(`${viewport.width}px: five routes, nested-route manifest/icon URLs and real asset MIME/content, More tools, logo, action URL/project retention, Escape/focus, overflow, targets, no runtime errors passed`);
  await page.close();
 }
 const signed=await browser.newPage();
 await signed.addInitScript(()=>localStorage.setItem('apex-gate-token','shell-fixture-token'));
 await signed.route('**/api/me',route=>route.fulfill(route.request().headers().authorization
  ? {json:{userId:'shell-user',displayName:'Signed In Fixture',role:'admin'}}
  : {status:403,json:{error:'Forbidden'}}));
 await signed.route('**/api/auth/config',route=>route.fulfill({json:{mode:'access'}}));
 await signed.goto(`${baseURL}/more`);
 await signed.getByRole('button',{name:'Sign out',exact:true}).click();
 await signed.locator('.signin').waitFor();
 assert.equal(await signed.locator('.shell-nav').count(),0);
 assert.equal(await signed.evaluate(()=>localStorage.getItem('apex-gate-token')),null);
 checks.push('Sign out: token cleared, protected views removed, server refusal returns sign-in');
 // Stable-token/cookie identity changes must remount all private views and
 // stop old actor requests from sharing their eventual payload with new views.
 const identity=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const actorIds={A:createCanonicalId('user'),B:createCanonicalId('user')};
 const taskIds={A:createCanonicalId('task'),B:createCanonicalId('task')};
 const eventIds={A:createCanonicalId('agenda'),B:createCanonicalId('agenda')};
 let actor='A',refresh=false,releaseIdentity,releaseOld;
 const identityGate=new Promise(resolve=>releaseIdentity=resolve);
 const oldGate=new Promise(resolve=>releaseOld=resolve);
 const oldStarted=new Set();
 const fixtureTask=who=>({taskId:taskIds[who],title:`${who} private task`,detail:null,jobId:null,assignedUserId:actorIds[who],dueDate:civilDay(),priority:'urgent',milestone:null,recurrence:'none',createdBy:actorIds[who],revision:1,createdAt:'2026-10-24T12:00:00.000Z',updatedAt:'2026-10-24T12:00:00.000Z',completedAt:null,completedBy:null,parentTaskId:null});
 const fixtureEvent=who=>({source:'appointment',id:eventIds[who],event:{eventId:eventIds[who],title:`${who} private appointment`,note:null,eventType:'meeting',jobId:null,assignedUserId:actorIds[who],allDay:true,startsOn:civilDay(),endsOn:civilDay(),startsAt:null,endsAt:null,timezone:'America/Chicago',createdBy:actorIds[who],revision:1,createdAt:'2026-10-24T12:00:00.000Z',updatedAt:'2026-10-24T12:00:00.000Z',cancelledAt:null,cancelledBy:null}});
 await identity.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  assert(!route.request().headers().authorization,'stable empty token represents provider/cookie identity');
  if(path==='/api/me') {
   if(refresh) await identityGate;
   return route.fulfill({json:{userId:actorIds[actor],displayName:`Actor ${actor}`,role:'office'}});
  }
  const who=actor;
  if(refresh && who==='A' && ['/api/tasks','/api/workspace-calendar'].includes(path)) {
   oldStarted.add(path);await oldGate;
  }
  const data=path==='/api/tasks'?[fixtureTask(who)]:path==='/api/workspace-calendar'?[fixtureEvent(who)]:[];
  return route.fulfill({json:data});
 });
 await identity.goto(`${baseURL}/today`);
 await identity.getByRole('heading',{name:'A private task',exact:true}).waitFor();
 await identity.locator('.cw-summary>.cw-entry').filter({hasText:'A private appointment'}).waitFor();
 refresh=true;
 await identity.evaluate(()=>window.dispatchEvent(new Event('focus')));
 for(let i=0;i<100 && oldStarted.size<2;i++) await delay(20);
 assert.equal(oldStarted.size,2,'both old actor private reads are in flight');
 actor='B';releaseIdentity();
 await identity.locator('.shell-user').filter({hasText:'Actor B'}).waitFor();
 assert.equal(await identity.getByText('A private appointment',{exact:true}).count(),0,'new actor never retains old private appointment');
 await identity.getByRole('heading',{name:'B private task',exact:true}).waitFor({timeout:5000});
 await identity.locator('.cw-summary>.cw-entry').filter({hasText:'B private appointment'}).waitFor({timeout:5000});
 releaseOld();
 await identity.waitForTimeout(100);
 assert.equal(await identity.getByText('A private appointment',{exact:true}).count(),0,'late old actor response cannot populate new actor view');
 assert.equal(await identity.getByRole('heading',{name:'A private task',exact:true}).count(),0);
 assert.equal(await identity.evaluate(()=>localStorage.getItem('apex-gate-token')),null);
 await identity.close();
 checks.push('Stable empty-token actor switch: old private task/calendar reads held; B remount gets fresh data before A release; late A response excluded');
 const denied=await browser.newPage();
 await denied.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Unauthorized'}}));
 await denied.route('**/api/auth/config',route=>route.fulfill({json:{mode:'access'}}));
 await denied.goto(`${baseURL}/more`);
 await denied.locator('.signin').waitFor();assert.equal(await denied.locator('.shell-nav').count(),0);checks.push('401: sign-in only; protected shell hidden');
 const offline=await browser.newPage();
 await offline.route('**/api/me',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
 await offline.goto(`${baseURL}/more`);await offline.getByRole('button',{name:'Try again'}).waitFor();assert.equal(await offline.locator('.shell-nav').count(),0);checks.push('503: retry UI; protected shell hidden');
 console.log(checks.join('\n'));writeFileSync(`${screenshotDir}/shell-smoke.log`,checks.join('\n')+'\n');
} finally {
 await browser?.close();
 if(server && server.exitCode===null) {const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}
 writeFileSync(`${screenshotDir}/shell-server.log`,serverLog);
}
