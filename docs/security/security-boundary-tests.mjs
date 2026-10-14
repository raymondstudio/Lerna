// Local security boundary tests. Never loads dotenv, Next runtime or provider SDKs.
// All application imports are replaced by explicit mocks; no network API is exposed.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
const require = createRequire(import.meta.url);
const ts = require('../../node_modules/typescript/lib/typescript.js');
const root = path.resolve(import.meta.dirname, '../..');
const rows = [];
const mode = process.argv.includes('--secure') ? 'secure' : 'characterize';
const A = { id: '00000000-0000-4000-8000-000000000001', email: 'a@fixture.invalid', app_metadata: {} };
const B = { id: '00000000-0000-4000-8000-000000000002', email: 'b@fixture.invalid', app_metadata: {} };
const D = { id: '00000000-0000-4000-8000-000000000003', email: 'admin@fixture.invalid', app_metadata: {} };
const sessions = [{ id: 'session-a', user_id: A.id, title: 'SECURITY_FIXTURE_A', created_at: '2026-10-12', updated_at: '2026-10-12', study_messages: [] },{ id: 'session-b', user_id: B.id, title: 'SECURITY_FIXTURE_B', study_messages: [] }];
const materials = [{ id: 'material-a', user_id: A.id, deleted_at: null, file_name: 'SECURITY_FIXTURE_A.txt', storage_path: 'fixture-a' },{ id: 'material-b', user_id: B.id, deleted_at: null, file_name: 'SECURITY_FIXTURE_B.txt', storage_path: 'fixture-b' }];
function client(user, {admin = false, rpcError = null} = {}) {
  const effects = [];
  const tables = { study_sessions: structuredClone(sessions), uploaded_materials: structuredClone(materials), notes: [], quizzes: [], quiz_questions: [] };
  const c = { effects, tables, auth: { getUser: async () => ({data: {user}, error: null}) }, rpc: async () => ({data: admin, error: rpcError}) };
  c.from = table => {
    let op='select', value, filters=[], single=false;
    const q = {};
    for(const name of ['select','order','limit','range','gte','lt','or']) q[name] = () => q;
    for(const name of ['eq','is']) q[name] = (key,val) => {filters.push([key,val]); return q;};
    for(const name of ['insert','upsert','update','delete']) q[name] = val => {op=name;value=val;return q;};
    q.single=q.maybeSingle=()=>{single=true;return q;};
    q.then=(resolve,reject)=>Promise.resolve().then(()=>{
      let data;
      if(op==='insert'||op==='upsert') {
        const inserted = (Array.isArray(value)?value:[value]).map((r,i)=>({id:'fixture-'+table+'-'+i,...r}));
        effects.push({table,op,value:structuredClone(value)});tables[table]??=[];tables[table].push(...inserted);data=single?inserted[0]:inserted;
      } else {
        const found=(tables[table]??[]).filter(r=>filters.every(([k,v])=>r[k]===v));
        if(op==='update'){effects.push({table,op,value:structuredClone(value),count:found.length});found.forEach(r=>Object.assign(r,value));}
        if(op==='delete'){effects.push({table,op,count:found.length});tables[table]=tables[table].filter(r=>!found.includes(r));}
        data=single?(found[0]??null):found;
      }
      return {data,error:null};
    }).then(resolve,reject);
    return q;
  };
  c.storage={from:()=>({upload:async()=>{effects.push({op:'storage-upload'});return {error:null}},remove:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://download.fixture.invalid/object'},error:null})})};
  return c;
}
const NextResponse = { json: (data,init={}) => new Response(JSON.stringify(data), {...init,headers:{'content-type':'application/json',...init.headers}}), redirect: url => {const r=new Response(null,{status:307,headers:{location:String(url)}});r.cookies={set(){}};return r;} };
async function load(rel, imports={}, env={}) {
  const code=ts.transpileModule(await fs.readFile(path.join(root,rel),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const logs=[];const exports={};
  const context=vm.createContext({exports,require:name=>{
    if(name==='next/server')return {NextResponse};
    if(Object.hasOwn(imports,name))return imports[name];
    throw Error('Blocked unexpected application import: '+name);
  },URL,Request,Response,Headers,Buffer,crypto:webcrypto,process:{env:{NODE_ENV:'test',...env}},console:Object.fromEntries(['log','info','warn','error'].map(k=>[k,(...args)=>logs.push(args)])),setTimeout,clearTimeout});
  new vm.Script(code,{filename:rel}).runInContext(context,{timeout:1000});return {exports,logs};
}
function req(url='https://lerna.fixture.invalid/api',body={},extra={}){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(body)});}
async function check(id,label,run){try{const {observed,secure,characterize=true}=await run();const pass=mode==='secure'?secure:characterize;rows.push({id,label,observed,secureExpectationMet:!!secure,result:pass?'PASS':'FAIL'});}catch(e){rows.push({id,label,result:'ERROR',error:e.message});}}
await check('AUTH-01','Validated user required before material queries',async()=>{
 const c=client(null);const m=await load('src/app/api/materials/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/materials/types':{MATERIAL_SELECT:'*'},'@/lib/materials/serialize':{serializeMaterial:x=>x}});const r=await m.exports.GET(new Request('https://lerna.fixture.invalid/api/materials'));return {observed:{status:r.status,effects:c.effects.length},secure:r.status===401&&c.effects.length===0};});
await check('BOLA-01','Owned session reads succeed; user A cannot read user B session',async()=>{
 const c=client(A);const m=await load('src/app/api/study-sessions/[sessionId]/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/study-sessions/title':{generateStudySessionTitle:x=>x}});const own=await m.exports.GET(req(),{params:Promise.resolve({sessionId:'session-a'})});const other=await m.exports.GET(req(),{params:Promise.resolve({sessionId:'session-b'})});return {observed:{own:own.status,other:other.status},secure:own.status===200&&other.status===404};});
await check('BOLA-02','Foreign-parent notes must be denied before insert',async()=>{
 const c=client(A);const m=await load('src/app/api/study-sessions/[sessionId]/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/study-sessions/title':{generateStudySessionTitle:x=>x}});const own=await m.exports.PATCH(req(undefined,{notes:'SECURITY_FIXTURE_A'}),{params:Promise.resolve({sessionId:'session-a'})});c.effects.length=0;const other=await m.exports.PATCH(req(undefined,{notes:'SECURITY_FIXTURE_ATTACK'}),{params:Promise.resolve({sessionId:'session-b'})});const writes=c.effects.filter(e=>e.table==='notes');return {observed:{own:own.status,other:other.status,foreignNotesWrites:writes.length},secure:own.status===200&&other.status>=400&&writes.length===0,characterize:own.status===200&&other.status>=400&&writes.length===1};});
await check('ADMIN-01','Anonymous and ordinary users denied; disposable admin accepted',async()=>{
 const statuses=[];for(const [u,admin]of [[null,false],[A,false],[D,true]]){const c=client(u,{admin});const m=await load('src/lib/auth/require-admin-api.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}});try{await m.exports.requireAdminApi();statuses.push(200)}catch(e){statuses.push(e.status)}}return {observed:statuses,secure:JSON.stringify(statuses)==='[401,403,200]'};});
await check('ADMIN-02','Database demotion must override email fallback',async()=>{
 const c=client(D,{admin:false});const m=await load('src/lib/auth/require-admin-api.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}},{ADMIN_EMAILS:D.email});let accepted=false;try{await m.exports.requireAdminApi();accepted=true}catch{}return {observed:{databaseAdmin:false,accepted},secure:!accepted,characterize:accepted};});
await check('ADMIN-03','Database outage must fail closed even with prior admin metadata',async()=>{
 const c=client({...D,app_metadata:{role:'admin'}},{rpcError:{message:'fixture outage'}});const m=await load('src/lib/auth/require-admin-api.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}});let accepted=false;try{await m.exports.requireAdminApi();accepted=true}catch{}return {observed:{accepted},secure:!accepted,characterize:accepted};});
await check('OAUTH-01','Local return accepted; external callback return denied',async()=>{
 const m=await load('src/app/auth/callback/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>({data:{user:A,session:{}},error:null})}})}});
 const request=next=>{const url='https://lerna.fixture.invalid/auth/callback?code=SYNTHETIC_CODE_ONLY&next='+encodeURIComponent(next);return {url,nextUrl:new URL(url),cookies:{getAll:()=>[]}}};
 const own=await m.exports.GET(request('/chat'));const other=await m.exports.GET(request('https://redirect.fixture.invalid/landing'));return {observed:{ownOrigin:new URL(own.headers.get('location')).origin,otherOrigin:new URL(other.headers.get('location')).origin},secure:new URL(own.headers.get('location')).origin==='https://lerna.fixture.invalid'&&new URL(other.headers.get('location')).origin==='https://lerna.fixture.invalid',characterize:new URL(other.headers.get('location')).origin==='https://redirect.fixture.invalid'};});
await check('OAUTH-02','Callback must not log authorization codes',async()=>{
 const m=await load('src/app/auth/callback/route.ts',{'@/lib/supabase/server':{}});const url='https://lerna.fixture.invalid/auth/callback?code=SECURITY_FIXTURE_SECRET_CODE&error=fixture';await m.exports.GET({url,nextUrl:new URL(url)});const leaks=JSON.stringify(m.logs).includes('SECURITY_FIXTURE_SECRET_CODE');return {observed:{syntheticCodeLogged:leaks},secure:!leaks,characterize:leaks};});
await check('OAUTH-03','Existing sanitizer rejects external, protocol-relative and backslash returns',async()=>{
 const m=await load('src/lib/auth/return-path.ts');const f=m.exports.sanitizeAuthReturnPath;const valid=f('/chat?fixture=1');const bad=['https://redirect.fixture.invalid','//redirect.fixture.invalid','/\\redirect.fixture.invalid','/\n/redirect.fixture.invalid'].map(x=>f(x));return {observed:{valid,bad},secure:valid==='/chat?fixture=1'&&bad.every(x=>x==='/chat')};});
await check('QUOTA-01','Quota service must deny on backend outage',async()=>{
 const good=await load('src/lib/services/quota.ts',{'@/lib/repositories/billing':{},'./business':{getUserQuotaUsage:async()=>({limits:{aiRequests:2},usage:{aiRequests:0}})}});const positive=await good.exports.checkQuota(A.id,'aiRequests');const m=await load('src/lib/services/quota.ts',{'@/lib/repositories/billing':{},'./business':{getUserQuotaUsage:async()=>{throw Error('fixture outage')}}});const r=await m.exports.checkQuota(A.id,'aiRequests');return {observed:{positiveAllowed:positive.allowed,allowed:r.allowed},secure:positive.allowed&&!r.allowed,characterize:positive.allowed&&r.allowed};});
await check('COST-01','Demo limiter positive 200 and negative 429; header and instance reset bypass',async()=>{
 let calls=0;const imports={'@/lib/gemini/client':{generateText:async()=>{calls++;return {text:'SECURITY_FIXTURE_MODEL'}}}};const m=await load('src/app/api/demo-chat/route.ts',imports);const statuses=[];for(let i=0;i<11;i++)statuses.push((await m.exports.POST(req(undefined,{message:'fixture'},{'x-forwarded-for':'192.0.2.1'}))).status);const rotated=(await m.exports.POST(req(undefined,{message:'fixture'},{'x-forwarded-for':'192.0.2.2'}))).status;const fresh=await load('src/app/api/demo-chat/route.ts',imports);const reset=(await fresh.exports.POST(req(undefined,{message:'fixture'},{'x-forwarded-for':'192.0.2.1'}))).status;return {observed:{first:statuses[0],eleventh:statuses[10],rotated,otherInstance:reset,modelMockCalls:calls},secure:statuses[0]===200&&statuses[10]===429&&rotated===429&&reset===429,characterize:statuses[0]===200&&statuses[10]===429&&rotated===200&&reset===200};});
await check('UPLOAD-01','Foreign session and unsupported MIME must stop before storage and processing',async()=>{
 const c=client(A);let processed=0;const m=await load('src/app/api/upload/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/materials/ingestion':{processMaterial:async()=>{processed++}},'@/lib/uploads/constants':{buildUploadPath:()=> 'fixture-only',UPLOADED_MATERIALS_BUCKET:'fixture-only'}});const request=(session,mime)=>({formData:async()=>new Map([['sessionId',session],['file',{name:'SECURITY_FIXTURE_A.txt',type:mime,size:16,arrayBuffer:async()=>new TextEncoder().encode('SECURITY_FIXTURE').buffer}]])});const own=await m.exports.POST(request('session-a','text/plain'));c.effects.length=0;const other=await m.exports.POST(request('session-b','application/x-fixture-unsupported'));return {observed:{own:own.status,other:other.status,storageWrites:c.effects.filter(e=>e.op==='storage-upload').length,processingCalls:processed},secure:own.status===200&&other.status>=400&&c.effects.length===0,characterize:own.status===200&&other.status===200&&processed===2};});
await check('QUIZ-01','Client-reported impossible score must be rejected',async()=>{
 const c=client(A);const m=await load('src/app/api/quiz/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}});const own=await m.exports.POST(req(undefined,{title:'SECURITY_FIXTURE',score:0,totalQuestions:1,questions:[{questionText:'fixture',correctAnswer:'a',userAnswer:'b',options:['a','b'],isCorrect:false}]}));const forged=await m.exports.POST(req(undefined,{title:'SECURITY_FIXTURE',score:999,totalQuestions:1,questions:[]}));return {observed:{own:own.status,forged:forged.status,savedScore:c.tables.quizzes.at(-1)?.score},secure:own.status===200&&forged.status===400,characterize:own.status===200&&forged.status===200&&c.tables.quizzes.at(-1)?.score===999};});
await check('DELETE-01','Elastic deletion failure must propagate or durably enqueue retry',async()=>{
 let attempts=0;const good=await load('src/lib/materials/elastic.ts',{'@/lib/elastic/client':{deleteByQuery:async()=>({deleted:1})},'@/lib/gemini/client':{EMBEDDING_DIMENSIONS:768}});await good.exports.deleteMaterialFromElastic('material-a',A.id);const m=await load('src/lib/materials/elastic.ts',{'@/lib/elastic/client':{deleteByQuery:async()=>{attempts++;throw Error('fixture unavailable')}},'@/lib/gemini/client':{EMBEDDING_DIMENSIONS:768}});let rejected=false;try{await m.exports.deleteMaterialFromElastic('material-a',A.id)}catch{rejected=true}return {observed:{attempts,rejected},secure:rejected,characterize:attempts===3&&!rejected};});
await check('RAG-01','Tenant filter precedes search even with foreign document ID',async()=>{
 let captured;const m=await load('src/lib/materials/elastic.ts',{'@/lib/elastic/client':{createIndexIfMissing:async()=>{},searchIndex:async(i,q)=>{captured=q;return {hits:{hits:[]}}}},'@/lib/gemini/client':{EMBEDDING_DIMENSIONS:768}});await m.exports.searchMaterialEmbeddings({userId:A.id,documentIds:['material-b'],queryEmbedding:[0,1]});const filters=captured.knn.filter;return {observed:{hasTrustedTenant:filters.some(f=>f.term?.user_id===A.id),hasMaterialFilter:filters.some(f=>f.terms?.document_id?.includes('material-b'))},secure:filters.some(f=>f.term?.user_id===A.id)&&filters.some(f=>f.terms?.document_id?.includes('material-b'))};});
await check('RAG-02','Explicit empty authorized set must not expand to all user materials',async()=>{
 const searches=[];const m=await load('src/lib/materials/retrieval.ts',{'@/lib/gemini/client':{generateEmbedding:async()=>[0,1]},'./elastic':{searchMaterialEmbeddings:async q=>{searches.push(q);return []}}});await m.exports.retrieveMaterialContext({userId:A.id,sessionId:'session-a',query:'fixture',documentIds:[]});return {observed:{searchCount:searches.length,unscopedFallback:searches.some(q=>!q.sessionId)},secure:searches.length===0,characterize:searches.some(q=>!q.sessionId)};});
const errors=rows.filter(x=>x.result!=='PASS');console.log(JSON.stringify({mode,environment:'dependency-mocked VM; synthetic fixtures only; zero provider calls',tests:rows,summary:{total:rows.length,passed:rows.length-errors.length,failed:errors.length,secureExpectationsMet:rows.filter(x=>x.secureExpectationMet).length}},null,2));if(errors.length)process.exitCode=1;
