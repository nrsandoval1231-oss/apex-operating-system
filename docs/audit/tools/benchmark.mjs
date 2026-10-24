// Audit utility: only point at the disposable local synthetic dataset.
if (!process.env.DATABASE_URL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) {
  throw new Error('Audit utilities require an explicitly configured loopback PostgreSQL database.');
}
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const root=process.cwd();
const pg=(await import(pathToFileURL(`${root}/packages/database/node_modules/pg/lib/index.js`))).default;
const {SignJWT}=await import(pathToFileURL(`${root}/apps/gate-api/node_modules/jose/dist/webapi/index.js`));
const db=new pg.Client({connectionString:process.env.DATABASE_URL}); await db.connect();
const actor=(await db.query("select user_id from app_users where active and role='admin' order by user_id limit 1")).rows[0].user_id;
const job=(await db.query('select job_id from projects order by job_id limit 1')).rows[0].job_id;
const secret='audit-benchmark-local-secret-01234567890123456789';
const server=spawn(process.execPath,['apps/gate-api/dist/main.js'],{cwd:root,env:{...process.env,PORT:'4194',HOST:'127.0.0.1',GATE_JWT_SECRET:secret},stdio:['ignore','ignore','pipe']});
let errors='';server.stderr.on('data',d=>errors+=d);
try {
 const deadline=Date.now()+20000;
 while(true){try{if((await fetch('http://127.0.0.1:4194/ready')).ok)break;}catch{} if(Date.now()>deadline)throw Error(errors||'startup timeout');await new Promise(r=>setTimeout(r,100));}
 const token=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(actor).setIssuer('apex-gate').setAudience('apex-gate-api').setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret));
 const output={samples:100,unit:'milliseconds',dataset:'same synthetic baseline PostgreSQL database',routes:{}};
 for(const route of ['/api/jobs','/api/today','/api/calendar',`/api/jobs/${job}/project`]){
  const times=[];for(let i=0;i<101;i++){const start=performance.now();const r=await fetch('http://127.0.0.1:4194'+route,{headers:{authorization:`Bearer ${token}`}});await r.arrayBuffer();if(!r.ok)throw Error(`${route}: ${r.status}`);if(i)times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);output.routes[route.replace(job,'<synthetic-job>')]={median:Math.round(times[50]*100)/100,p95:Math.round(times[94]*100)/100};
 }
 writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
}finally{server.kill('SIGTERM');await db.end();}
