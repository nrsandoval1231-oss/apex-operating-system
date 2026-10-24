// Audit utility: only point at the disposable local synthetic dataset.
if (!process.env.DATABASE_URL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) {
  throw new Error('Audit utilities require an explicitly configured loopback PostgreSQL database.');
}
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const root=process.cwd();
const {PostgresDatabase}=await import(pathToFileURL(`${root}/packages/database/dist/index.js`));
const {GateService}=await import(pathToFileURL(`${root}/packages/gate-service/dist/index.js`));
const db=PostgresDatabase.create({url:process.env.DATABASE_URL});
let queries=0;const service=new GateService({query:(...args)=>{queries++;return db.query(...args)},transaction:work=>db.transaction(work)});
try{
 const cards=await service.getActionCards('2026-10-24');
 const count=(await db.query('select count(*)::int as jobs from jobs')).rows[0].jobs;
 const gate=(await db.query("select payload->>'gateInstanceId' as gate_instance_id from events where payload ? 'gateInstanceId' limit 1")).rows[0].gate_instance_id;
 const plan=await db.query("explain (analyze, buffers, format json) select event_type, job_id, payload, occurred_at, actor from events where payload->>'gateInstanceId'=$1 order by recorded_at,event_id",[gate]);
 const output={jobs:count,cards:cards.length,action_card_query_count:queries,gate_replay_plan:plan.rows[0]['QUERY PLAN']};
 writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({jobs:count,cards:cards.length,action_card_query_count:queries}));
}finally{await db.close()}
