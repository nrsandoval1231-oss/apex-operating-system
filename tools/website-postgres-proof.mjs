import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PostgresDatabase,applyOperationalMigrations} from '../packages/database/dist/index.js';
import {createPublicLeadHandler} from '../apps/gate-api/dist/publicLeads.js';
const url=process.env.APEX_WEBSITE_PROOF_DATABASE_URL;
if(!url)throw new Error('Set APEX_WEBSITE_PROOF_DATABASE_URL to disposable loopback review database.');
const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.port!=='55442'||u.pathname!=='/apex_website_review')throw new Error('Refusing non-review database.');
let db=PostgresDatabase.create({url,applicationName:'website2-isolated-proof'});
await db.withMigrationLock(c=>applyOperationalMigrations(c));
const handler=createPublicLeadHandler({db,enabled:true,origins:['https://review.example']});
const server=createServer(async(req,res)=>{if(!await handler(req,res)){res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const endpoint='http://127.0.0.1:'+server.address().port+'/api/public/v1/leads';
const post=async body=>{const r=await fetch(endpoint,{method:'POST',headers:{origin:'https://review.example','content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
const suffix=Date.now().toString(36).slice(-4), websiteId='apex_'+Math.floor(Date.now()/1000)+'_'+suffix;
const body={schema_version:2,lead_id:websiteId,vertical:'Designer Pools',first_name:'Synthetic',last_name:'Review',email:'website-postgres@example.invalid',phone:'8065550100',consent_sms:true,consent_text:'I agree to receive text messages from Apex Designer Pools about my quote. ~2 msgs/month, data rates may apply. Reply STOP to opt out.',source:'acceptance',medium:'isolated-postgres',campaign:'website2',landing_page:'/designer-pools',referrer:'',fbclid:'',gclid:'',page_submitted:'/designer-pools',device:'mobile',submitted_at:new Date().toISOString(),project:{type:'New pool',city:'Lubbock',timeline:'Just exploring',budget:'Not yet set',size:'Discuss size',features:['Spa'],condition:'',description:'Synthetic isolated acceptance fixture'},website:'',consent_version:'website-2-20261024'};
const report={startedAt:new Date().toISOString(),adapter:'PostgresDatabase',database:'disposable Docker PostgreSQL17 loopback',websiteId};
try{
 const race=await Promise.all([post(body),post(body)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,201]);assert.equal(race[0].body.canonical_lead_id,race[1].body.canonical_lead_id);report.race=race;
 const conflict=await post({...body,project:{...body.project,description:'Changed'}});assert.equal(conflict.status,409);report.changedReplay=conflict.status;
 const rows=await db.query('select lead_id,accepted_payload,accepted_payload_version from leads where intake_source=$1 and source_record_id=$2',['website',websiteId]);assert.equal(rows.rows.length,1);
 const saved=rows.rows[0];assert.equal(saved.accepted_payload_version,2);assert.equal(saved.accepted_payload.consent_text,body.consent_text);assert.equal(saved.accepted_payload.consent_sms,true);assert.deepEqual(saved.accepted_payload.project,body.project);assert.equal('website' in saved.accepted_payload,false);assert.equal(saved.accepted_payload.landing_page,body.landing_page);report.consentAndProjectAndAttributionPreserved=true;
 await db.close();db=PostgresDatabase.create({url,applicationName:'website2-reopen-proof'});
 const reopened=await db.query('select lead_id from leads where source_record_id=$1 and intake_source=$2',[websiteId,'website']);assert.equal(reopened.rows[0].lead_id,saved.lead_id);report.persistedAcrossAdapterRestart=true;report.status='PASS';
}finally{await new Promise(r=>server.close(r));await db.close();report.finishedAt=new Date().toISOString();const out=resolve('../website-2-evidence');await mkdir(out,{recursive:true});await writeFile(resolve(out,'postgres-intake-proof.json'),JSON.stringify(report,null,2));}
console.log(report);

