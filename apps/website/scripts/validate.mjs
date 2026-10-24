import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
function run(label,args){console.log(`\n▶ ${label}`);const r=spawnSync('npx',args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status??1)}
run('Astro typecheck',['astro','check']);run('Astro static build',['astro','build']);
const dist=join(root,'dist'), pages=[];
function walk(dir){for(const name of readdirSync(dir)){const f=join(dir,name);if(statSync(f).isDirectory())walk(f);else if(name==='index.html')pages.push({path:'/'+relative(dist,dirname(f)).replaceAll('\\','/').replace(/^\.$/,'').replace(/^\//,'').replace(/\/$/,''),html:readFileSync(f,'utf8')})}}
walk(dist);const routes=['/','/designer-pools','/concrete-coating','/design-and-renovation','/pools','/coating','/renovation','/service','/about-apex','/work','/contact','/process','/service-areas','/privacy','/terms','/legacy-privacy'];
const failures=[];for(const route of routes)if(!pages.some(p=>p.path===route))failures.push(`missing route ${route}`);
const home=(pages.find(p=>p.path==='/')?.html??'').toLowerCase();
for(const copy of ['anything construction.','apex gets it done.','lubbock’s home for custom pools, concrete coatings, and renovations.','get a free quote','view our work'])if(!home.includes(copy))failures.push(`home copy missing: ${copy}`);
for(const p of pages){if((p.html.match(/<h1[ >]/g)||[]).length!==1)failures.push(`${p.path}: expected one h1`);if(/data-stock="true"/.test(p.html))failures.push(`${p.path}: stock image present`);if(!p.html.includes('id="content"'))failures.push(`${p.path}: skip target missing`)}
if(failures.length){console.error('\nValidation failures:\n'+failures.map(x=>' - '+x).join('\n'));process.exit(1)}console.log(`\nWEB2 artifact checks passed for ${pages.length} pages and ${routes.length} required paths.`);
