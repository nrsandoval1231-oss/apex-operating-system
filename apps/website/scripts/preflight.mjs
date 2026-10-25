import { existsSync,readFileSync,readdirSync,statSync } from 'node:fs';import {join,relative,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');const prod=process.env.PUBLIC_ENV==='production',blocks=[];
const callOnly=process.env.PUBLIC_PREVIEW_INTAKE_DISABLED==='1';
if(callOnly&&(process.env.PUBLIC_ENV!=='staging'||process.env.PUBLIC_LEAD_WEBHOOK_URL||process.env.PUBLIC_LEAD_WEBHOOK_URL_TEST))blocks.push('call-only preview requires staging and both inquiry endpoints unset');
if(!existsSync(dist))blocks.push('dist/ is missing; run npm run build first');else{
 const pages=[];function walk(d){for(const n of readdirSync(d)){const f=join(d,n);if(statSync(f).isDirectory())walk(f);else if(n==='index.html')pages.push({path:'/'+relative(dist,dirname(f)).replaceAll('\\','/').replace(/^\.$/,'').replace(/^\//,'').replace(/\/$/,''),html:readFileSync(f,'utf8')})}}walk(dist);
 const robots=readFileSync(join(dist,'robots.txt'),'utf8');if(prod&&robots.includes('Disallow: /'))blocks.push('production robots.txt disallows crawling');if(!prod&&!robots.includes('Disallow: /'))blocks.push('preview robots.txt must disallow crawling');
 for(const p of pages){if(prod&&/name="robots"[^>]*noindex/i.test(p.html))blocks.push(`${p.path} is noindex in production`);if(!prod&&!/name="robots"[^>]*noindex/i.test(p.html))blocks.push(`${p.path} lacks preview noindex`);if(/data-stock="true"/.test(p.html))blocks.push(`${p.path} contains stock media`)}
 const web=prod?(process.env.PUBLIC_LEAD_WEBHOOK_URL??''):(process.env.PUBLIC_LEAD_WEBHOOK_URL_TEST??'');if(!web&&!callOnly)blocks.push(`missing ${prod?'PUBLIC_LEAD_WEBHOOK_URL':'PUBLIC_LEAD_WEBHOOK_URL_TEST'}; the quote form must have an endpoint or provide a clear contact fallback`);
 if(callOnly)for(const p of pages){if(p.html.includes('id="quote"')&&(!p.html.includes('data-call-only-preview="true"')||!p.html.includes('href="tel:+18066050502"')||/<form\b/i.test(p.html)))blocks.push(`${p.path} must render only the explicit phone fallback, without an inquiry form`)}
 for(const p of ['/privacy/','/terms/','/legacy-privacy/'])if(!existsSync(join(dist,p,'index.html')))blocks.push(`missing legal route ${p}`);
}
if(blocks.length){console.error('WEB2 preflight failed:\n'+blocks.map(x=>' - '+x).join('\n'));process.exit(1)}console.log(`WEB2 preflight passed (${prod?'production':'preview'} build; ${process.env.PUBLIC_ENV??'development'}).`);
