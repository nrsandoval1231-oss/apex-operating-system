import { chromium } from '../../website/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
// Shell-only smoke: browser API reads are intercepted with synthetic identity/empty lists.
// This validates navigation and authentication presentation, not backend persistence.
// Run after building and starting Vite preview (default port 4195):
//   node apps/apex-os/tests/shell.e2e.mjs
// Override APEX_SHELL_URL and APEX_SCREENSHOT_DIR for another preview/artifact location.
const baseURL=(process.env.APEX_SHELL_URL ?? 'http://127.0.0.1:4195/app').replace(/\/$/,'');
const screenshotDir=process.env.APEX_SCREENSHOT_DIR ?? '/tmp/apex2/screenshots';
mkdirSync(screenshotDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[];
try {
 for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   await route.fulfill({json:path==='/api/me'?{userId:'shell-smoke-user',displayName:'Shell Test',role:'admin'}:[]});
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
  await quick.click();
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
  await page.screenshot({path:`${screenshotDir}/shell-${viewport.width}.png`,fullPage:true});
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
 const denied=await browser.newPage();
 await denied.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Unauthorized'}}));
 await denied.route('**/api/auth/config',route=>route.fulfill({json:{mode:'access'}}));
 await denied.goto(`${baseURL}/more`);
 await denied.locator('.signin').waitFor();assert.equal(await denied.locator('.shell-nav').count(),0);checks.push('401: sign-in only; protected shell hidden');
 const offline=await browser.newPage();
 await offline.route('**/api/me',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
 await offline.goto(`${baseURL}/more`);await offline.getByRole('button',{name:'Try again'}).waitFor();assert.equal(await offline.locator('.shell-nav').count(),0);checks.push('503: retry UI; protected shell hidden');
 console.log(checks.join('\n'));writeFileSync(`${screenshotDir}/shell-smoke.log`,checks.join('\n')+'\n');
} finally {await browser.close();}
