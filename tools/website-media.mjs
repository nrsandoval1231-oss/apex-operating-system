import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(), web=resolve(root,'apps/website'), docs=resolve(web,'docs/rebuild-20261024');
const sharpDir=(await readdir(resolve(root,'node_modules/.pnpm'))).find(x=>x.startsWith('sharp@'));
const sharp=(await import(pathToFileURL(resolve(root,'node_modules/.pnpm',sharpDir,'node_modules/sharp/dist/index.mjs')))).default;
const crawl=JSON.parse(await readFile(resolve(docs,'source-crawl.json'),'utf8'));
const home=JSON.parse(await readFile(resolve(docs,'source-home.json'),'utf8'));
delete home.html;await writeFile(resolve(docs,'source-home.json'),JSON.stringify(home,null,2)+'\n');
const urls=new Map();
for(const page of crawl.data){for(const m of page.markdown.matchAll(/https:\/\/apexgetsitdone\.com\/snapshot\/media\/uploads\/[^)\s"]+/g)){const u=m[0];if(!/\.(jpg|png|webp)$/i.test(u))continue; if(!urls.has(u))urls.set(u,[]);urls.get(u).push(page.metadata.sourceURL);}}
await mkdir(resolve(docs,'originals'),{recursive:true});await mkdir(resolve(web,'public/images/projects'),{recursive:true});
const assets=[];
for(const [url,pages] of urls){const name=basename(new URL(url).pathname), original=resolve(docs,'originals',name);try{
let buf;try{buf=await readFile(original);}catch{const res=await fetch(url);if(!res.ok)throw new Error('HTTP '+res.status);buf=Buffer.from(await res.arrayBuffer());await writeFile(original,buf);}
const meta=await sharp(buf).metadata(),sha256=createHash('sha256').update(buf).digest('hex');
const project=/ApexDPv|ApexJob|Apex-dr|Before-1|After-1/.test(name), thumb=/-\d+x\d+\./.test(name), id=name.replace(/\.[^.]+$/,'').toLowerCase();
const variants=[];
if(project&&!thumb){for(const w of [480,800,1440]){const width=Math.min(w,meta.width);if(variants.some(x=>x.width===width))continue;const file='/images/projects/'+id+'-'+width+'.webp';const output=await sharp(buf).rotate().resize({width,withoutEnlargement:true}).webp({quality:82}).toBuffer();await writeFile(resolve(web,'public'+file),output);variants.push({width,src:file,bytes:output.length});}const jpg='/images/projects/'+id+'.jpg';await sharp(buf).rotate().jpeg({quality:85}).toFile(resolve(web,'public'+jpg));}
assets.push({name,url,sourcePages:[...new Set(pages)],sha256,width:meta.width,height:meta.height,bytes:buf.length,classification:project?'APEX project image published in source gallery':'brand or supporting image',thumbnail:thumb,variants});
}catch(e){assets.push({name,url,error:String(e)});}}
await writeFile(resolve(docs,'asset-inventory.json'),JSON.stringify({retrievedAt:new Date().toISOString(),scope:'All image URLs discoverable in Firecrawl crawl markdown; original hashes and source references preserved. Site-publication provenance, no invented project locations.',assets},null,2)+'\n');
console.log(JSON.stringify(assets.map(a=>({name:a.name,width:a.width,height:a.height,error:a.error,variants:a.variants?.length})),null,2));

