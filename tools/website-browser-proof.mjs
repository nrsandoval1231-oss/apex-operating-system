import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const req=createRequire(resolve('apps/website/package.json'));
const {chromium}=req('@playwright/test');
const axeModule=req('@axe-core/playwright');
const AxeBuilder=axeModule.default??axeModule;
const base=process.env.PROOF_BASE_URL||'http://127.0.0.1:4330';
const proofHost=new URL(base).hostname;
if(!['localhost','127.0.0.1','apex-website-2-review.pages.dev','website2-preview.apex-website-2-review.pages.dev'].includes(proofHost))throw new Error('Only isolated review origins are permitted.');
const out=process.env.PROOF_OUTPUT||resolve('../website-2-evidence');
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={startedAt:new Date().toISOString(),base,routes:[],links:[],accessibility:[],conversions:[],errors:[]};
const routes=['/','/designer-pools','/concrete-coating','/design-and-renovation','/about-apex','/work','/contact','/process','/service-areas','/service','/privacy','/terms','/legacy-privacy','/pools','/coating','/renovation',...(['localhost','127.0.0.1'].includes(proofHost)?[]:['/apex-designer-pools-landing-page','/apex-privacy-policy','/privacy-policy-apex-designer-pools','/terms-and-conditions','/privacy-policy'])];
const links=new Set();
try{
for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:412,height:915},{width:320,height:740}]){
 const context=await browser.newContext({viewport});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of routes){
  const response=await page.goto(base+route,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}scrollTo(0,0);});
  await page.locator('img').evaluateAll(async imgs=>{imgs.forEach(img=>img.loading='eager');await Promise.race([Promise.all(imgs.map(img=>img.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,10000))]);});
  const row=await page.evaluate(()=>({title:document.title,h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth,canonical:document.querySelector('link[rel=canonical]')?.href,noindex:document.querySelector('meta[name=robots]')?.content,broken:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),stock:[...document.images].filter(i=>i.hasAttribute('data-stock')||(i.currentSrc.includes("/stock/")||i.currentSrc.includes("/v2/"))).map(i=>i.currentSrc),links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))}));
  row.links.forEach(l=>{if(l?.startsWith('/'))links.add(l.split('#')[0]||'/');});
  delete row.links;
  const item={route,viewport:viewport.width,status:response.status(),...row};report.routes.push(item);
  if(item.status!==200||item.h1!==1||item.overflow||item.broken.length||item.stock.length)report.errors.push({route,viewport:viewport.width,reason:'route assertion',details:item});
  if(viewport.width===1440||viewport.width===390){
    const ax=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    const violations=ax.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
    report.accessibility.push({route,width:viewport.width,violations});
    if(violations.some(v=>['serious','critical'].includes(v.impact)))report.errors.push({route,width:viewport.width,reason:'accessibility serious/critical'});
  }
  if(['/', '/designer-pools','/concrete-coating','/design-and-renovation','/work'].includes(route)&&[1440,390].includes(viewport.width)){
    await page.screenshot({path:resolve(out,(route==='/'?'home':route.slice(1))+'-'+viewport.width+'.png'),fullPage:true});
  }
 }
 if(viewport.width<720){
  await page.goto(base);const menu=page.getByRole('button',{name:/menu/i});await menu.click();
  if(await menu.getAttribute('aria-expanded')!=='true')report.errors.push({reason:'mobile menu not open',width:viewport.width});
  await page.keyboard.press('Escape');
  if(await menu.getAttribute('aria-expanded')!=='false')report.errors.push({reason:'mobile menu Escape',width:viewport.width});
 }
 if(errors.length)report.errors.push({width:viewport.width,pageErrors:errors});
 await context.close();
}
const check=await browser.newPage();
for(const path of links){const r=await check.request.get(base+path);report.links.push({path,status:r.status()});if(r.status()>=400)report.errors.push({reason:'broken internal link',path,status:r.status()});}
await check.close();
if(process.env.PROOF_SUBMIT==='1'){
 for(const [route,vertical] of [['/designer-pools','Designer Pools'],['/concrete-coating','Concrete Coating'],['/design-and-renovation','Design & Renovation'],['/service','Pool Service']]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base+route+'?utm_source=acceptance&utm_medium=isolated-fixture');
  const form=page.locator('#quote form');await form.scrollIntoViewIfNeeded();
  await form.getByRole('button',{name:/Continue/}).click();
  await form.getByLabel('Project type',{exact:true}).selectOption({index:1});
  await form.getByLabel('Project city',{exact:true}).fill('Lubbock');
  await form.getByRole('button',{name:/Continue/}).click();
  await form.getByLabel('First name',{exact:true}).fill('Website');
  await form.getByLabel('Last name',{exact:true}).fill('Acceptance');
  await form.getByLabel('Email',{exact:true}).fill('website-acceptance@example.invalid');
  if(vertical==='Designer Pools')await form.locator('.consent-check input').check();
  const request=page.waitForRequest(r=>r.url().includes('/api/public/v1/leads')&&r.method()==='POST');
  const response=page.waitForResponse(r=>r.url().includes('/api/public/v1/leads')&&r.request().method()==='POST');
  await form.getByRole('button',{name:/Send project request/}).click();
  const sent=await request;const payload=sent.postDataJSON();const endpoint=sent.url();const result=await response;const acknowledgement=await result.json();
  await page.getByRole('status').waitFor();
  const conversion={route,vertical,status:result.status(),acknowledgement,websiteId:payload.lead_id,consent:payload.consent_sms,consentVersion:payload.consent_version};
  if(result.status()!==201||acknowledgement.status!=='accepted'||acknowledgement.lead_id!==payload.lead_id)report.errors.push({reason:'persistence acknowledgement',conversion});
  if(vertical==='Designer Pools'){
    const replay=await page.evaluate(async({payload,endpoint})=>{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:r.status,body:await r.json()};},{payload,endpoint});
    conversion.replay=replay;if(replay.status!==200||replay.body.status!=='duplicate')report.errors.push({reason:'duplicate acceptance',replay});
    const changed=await page.evaluate(async({payload,endpoint})=>{payload.project.description='Changed after accepted';const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return r.status;},{payload,endpoint});
    conversion.changedReplay=changed;if(changed!==409)report.errors.push({reason:'changed replay not rejected',changed});
  }
  report.conversions.push(conversion);
  await page.screenshot({path:resolve(out,'confirmation-'+route.slice(1)+'.png')});
  await page.close();
 }
}
} catch(e){report.errors.push({reason:'runner error',message:String(e),stack:e.stack});}
finally{report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'browser-proof.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({routes:report.routes.length,links:report.links.length,a11y:report.accessibility.length,conversions:report.conversions.length,errors:report.errors}));
if(report.errors.length)process.exitCode=1;

