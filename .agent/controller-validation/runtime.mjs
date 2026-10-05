import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(resolve('apps/website/package.json'));
const {chromium}=require('@playwright/test');
const root=resolve('apps/website/public/cinematic/v1');
const paths=['frames/desktop','mobile','fallback'].flatMap(d=>readdirSync(resolve(root,d)).filter(f=>f.endsWith('.webp')).map(f=>d+'/'+f));
const browser=await chromium.launch();const page=await browser.newPage();await page.goto('http://127.0.0.1:4330/');
const results=await page.evaluate(async paths=>{const out=[];for(const p of paths){const r=await fetch('/cinematic/v1/'+p);const b=await r.arrayBuffer();const bitmap=await createImageBitmap(new Blob([b]));const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');out.push({path:p,status:r.status,bytes:b.byteLength,width:bitmap.width,height:bitmap.height,sha256:hash});bitmap.close();}return out;},paths);
await browser.close();for(const r of results){if(r.status!==200||r.sha256!==createHash('sha256').update(readFileSync(resolve(root,r.path))).digest('hex'))throw Error('Mismatch '+r.path);}
writeFileSync('.agent/controller-validation/runtime.json',JSON.stringify({result:'PASS',decoded:results.length,results},null,2));console.log('PASS browser fetched and decoded '+results.length+' runtime WebP assets with matching SHA256');
