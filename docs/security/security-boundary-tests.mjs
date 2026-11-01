// Local security boundary tests. Never loads dotenv, Next runtime or provider SDKs.
// All application imports are replaced by explicit mocks; no network API is exposed.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import crypto, { webcrypto } from 'node:crypto';
import asyncHooks from 'node:async_hooks';
const require = createRequire(import.meta.url);
const ts = require('../../node_modules/typescript/lib/typescript.js');
const zod = require('../../node_modules/zod');
const root = path.resolve(import.meta.dirname, '../..');
const rows = [];
const mode = process.argv.includes('--secure') ? 'secure' : 'characterize';
const A = { id: '00000000-0000-4000-8000-000000000001', email: 'a@fixture.invalid', app_metadata: {} };
const B = { id: '00000000-0000-4000-8000-000000000002', email: 'b@fixture.invalid', app_metadata: {} };
const D = { id: '00000000-0000-4000-8000-000000000003', email: 'admin@fixture.invalid', app_metadata: {} };
const SA = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const SB = '22222222-2222-4222-8222-bbbbbbbbbbbb';
const MA = '11111111-1111-4111-8111-cccccccccccc';
const MB = '22222222-2222-4222-8222-dddddddddddd';
const OP = '11111111-1111-4111-8111-eeeeeeeeeeee';
const sessions = [{ id: SA, user_id: A.id, title: 'SECURITY_FIXTURE_A', created_at: '2026-10-12T00:00:00Z', updated_at: '2026-10-12T00:00:00Z', notes: '', notes_revision: 0, study_messages: [] },{ id: SB, user_id: B.id, title: 'SECURITY_FIXTURE_B', created_at: '2026-10-12T00:00:00Z', updated_at: '2026-10-12T00:00:00Z', notes: '', notes_revision: 0, study_messages: [] }];
const materials = [{ id: MA, user_id: A.id, session_id: SA, status: 'ready', deleted_at: null, file_name: 'SECURITY_FIXTURE_A.txt', file_type: 'text/plain', storage_path: `${A.id}/${SA}/fixture-a.txt` },{ id: MB, user_id: B.id, session_id: SB, status: 'ready', deleted_at: null, file_name: 'SECURITY_FIXTURE_B.txt', file_type: 'text/plain', storage_path: `${B.id}/${SB}/fixture-b.txt` }];
function client(user, {admin = false, rpcError = null, demoState = { count: 0 }} = {}) {
  const effects = [];
  const tables = { study_sessions: structuredClone(sessions), uploaded_materials: structuredClone(materials), study_messages: [], courses: [], notes: [], quizzes: [], quiz_questions: [] };
  const c = { effects, tables, auth: { getUser: async () => ({data: {user}, error: null}), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2' }, error: null }) } }, rpc: async (name, args = {}) => {
    if (rpcError) return { data: null, error: rpcError };
    if (name === 'is_active_user') return { data: Boolean(user), error: null };
    if (name === 'is_admin') return { data: Boolean(user && admin), error: null };
    if (name === 'save_session_notes') {
      const found = tables.study_sessions.find(s => s.id === args.p_session_id && s.user_id === user?.id);
      if (!found) return { data: null, error: { code: 'PT404', message: 'SESSION_NOT_FOUND' } };
      found.notes = args.p_notes; found.notes_revision = Number(found.notes_revision ?? 0) + 1;
      effects.push({ table: 'notes', op: 'upsert', value: { session_id: args.p_session_id, content: args.p_notes } });
      return { data: { session: structuredClone(found), noteWrite: { operationId: args.p_operation_id, appliedRevision: found.notes_revision, replayed: false } }, error: null };
    }
    if (name === 'reserve_operation') return { data: { id: args.p_id, state: 'pending', replayed: false }, error: null };
    if (name === 'finish_operation') return { data: true, error: null };
    if (name === 'reserve_demo_operation') { demoState.count += 1; return { data: demoState.count <= 10, error: null }; }
    if (name === 'save_practice_quiz') {
      const row = { id: 'fixture-quiz-0', ...args.p_payload };
      tables.quizzes.push(row); effects.push({ table: 'quizzes', op: 'insert', value: structuredClone(row) });
      return { data: row.id, error: null };
    }
    return { data: admin, error: null };
  } };
  c.from = table => {
    let op='select', value, filters=[], single=false;
    const q = {};
    for(const name of ['select','order','limit','range','gte','lt','or','in']) q[name] = () => q;
    for(const name of ['eq','is']) q[name] = (key,val) => {filters.push([key,val]); return q;};
    for(const name of ['insert','upsert','update','delete']) q[name] = val => {op=name;value=val;return q;};
    q.single=q.maybeSingle=()=>{single=true;return q;};
    q.then=(resolve,reject)=>Promise.resolve().then(()=>{
      let data;
      if(op==='insert'||op==='upsert') {
        const inserted = (Array.isArray(value)?value:[value]).map((r,i)=>({id:`11111111-1111-4111-8111-00000000000${i}`,...r}));
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
function makeRes(body,init={}){const r=new Response(body,init);const jar=new Map();r.cookies={set(k,v,o={}){const i=typeof k==='object'?k:{name:k,value:v,...o};jar.set(i.name,i);},get:k=>jar.get(k),getAll:()=>[...jar.values()]};return r;}
const NextResponse = { json: (data,init={}) => makeRes(JSON.stringify(data), {...init,headers:{'content-type':'application/json',...init.headers}}), redirect: url => makeRes(null,{status:307,headers:{location:String(url)}}) };
function resolveLocal(spec, fromFile) {
  const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : (spec.startsWith('./') || spec.startsWith('../')) ? path.resolve(path.dirname(fromFile), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (fsSync.existsSync(c) && fsSync.statSync(c).isFile()) return c;
  return null;
}
const transpileCache = new Map();
function transpileFile(filePath) {
  if (!transpileCache.has(filePath)) {
    transpileCache.set(filePath, ts.transpileModule(fsSync.readFileSync(filePath,'utf8'), {compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  return transpileCache.get(filePath);
}
async function load(rel, imports={}, env={}) {
  await fs.access(path.join(root,rel));
  const logs=[]; const cache=new Map();
  const defaultAdmin = client(null);
  const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,FormData,File,Blob,Buffer,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,AbortController,AbortSignal,crypto:webcrypto,process:{env:{NODE_ENV:'test',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-key',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key',...env},cwd:()=>root},console:Object.fromEntries(['log','info','warn','error'].map(k=>[k,(...args)=>logs.push(args)])),setTimeout,clearTimeout});
  function loadSync(filePath) {
    if (cache.has(filePath)) return cache.get(filePath);
    const code=transpileFile(filePath);
    const exports={}; const module={exports}; cache.set(filePath,exports);
    const reqFn=name=>{
      if(name==='next/server')return {NextResponse};
      if(name==='node:crypto'||name==='crypto')return crypto;
      if(name==='node:async_hooks'||name==='async_hooks')return asyncHooks;
      if(name==='zod')return zod;
      if(Object.hasOwn(imports,name))return imports[name];
      if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>defaultAdmin};
      const resolved=resolveLocal(name,filePath);
      if(resolved){
        const relKey='@/'+path.relative(path.join(root,'src'),resolved).replaceAll('\\','/').replace(/\.tsx?$/,'');
        if(Object.hasOwn(imports,relKey))return imports[relKey];
        if(relKey==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>defaultAdmin};
        return loadSync(resolved);
      }
      throw Error('Blocked unexpected application import: '+name);
    };
    const fn=new vm.Script(`(function(exports,module,require){${code}\n})`,{filename:path.relative(root,filePath)}).runInContext(context,{timeout:5000});
    fn(exports,module,reqFn);
    cache.set(filePath,module.exports); return module.exports;
  }
  return {exports:loadSync(path.join(root,rel)),logs};
}
function req(url='https://lerna.fixture.invalid/api',body={},extra={}){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(body)});}
async function check(id,label,run){try{const {observed,secure,characterize=true}=await run();const pass=mode==='secure'?secure:characterize;rows.push({id,label,observed,secureExpectationMet:!!secure,result:pass?'PASS':'FAIL'});}catch(e){rows.push({id,label,result:'ERROR',error:e.message});}}
await check('AUTH-01','Validated user required before material queries',async()=>{
 const c=client(null);const m=await load('src/app/api/materials/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>c},'@/app/api/upload/route':{POST:async()=>NextResponse.json({},{status:401})}});const r=await m.exports.GET(new Request('https://lerna.fixture.invalid/api/materials'));return {observed:{status:r.status,effects:c.effects.length},secure:r.status===401&&c.effects.length===0};});
await check('BOLA-01','Owned session reads succeed; user A cannot read user B session',async()=>{
 const c=client(A);const m=await load('src/app/api/study-sessions/[sessionId]/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/study-sessions/title':{generateStudySessionTitle:x=>x}});const own=await m.exports.GET(req(),{params:Promise.resolve({sessionId:SA})});const other=await m.exports.GET(req(),{params:Promise.resolve({sessionId:SB})});return {observed:{own:own.status,other:other.status},secure:own.status===200&&other.status===404};});
await check('BOLA-02','Foreign-parent notes must be denied before insert',async()=>{
 const c=client(A);const m=await load('src/app/api/study-sessions/[sessionId]/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/study-sessions/title':{generateStudySessionTitle:x=>x}});const own=await m.exports.PATCH(req(undefined,{notes:'SECURITY_FIXTURE_A',expectedNotesRevision:0,operationId:OP}),{params:Promise.resolve({sessionId:SA})});c.effects.length=0;const other=await m.exports.PATCH(req(undefined,{notes:'SECURITY_FIXTURE_ATTACK',expectedNotesRevision:0,operationId:OP}),{params:Promise.resolve({sessionId:SB})});const writes=c.effects.filter(e=>e.table==='notes');return {observed:{own:own.status,other:other.status,foreignNotesWrites:writes.length},secure:own.status===200&&other.status>=400&&writes.length===0,characterize:own.status===200&&other.status>=400&&writes.length===0};});
await check('ADMIN-01','Anonymous and ordinary users denied; disposable admin accepted',async()=>{
 const statuses=[];for(const [u,admin]of [[null,false],[A,false],[D,true]]){const c=client(u,{admin});const m=await load('src/lib/auth/require-admin-api.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}});try{await m.exports.requireAdminApi();statuses.push(200)}catch(e){statuses.push(e.status)}}return {observed:statuses,secure:JSON.stringify(statuses)==='[401,403,200]'};});
await check('ADMIN-02','Database demotion must override email fallback',async()=>{
 const c=client(D,{admin:false});const m=await load('src/lib/auth/require-admin-api.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}},{ADMIN_EMAILS:D.email});let accepted=false;try{await m.exports.requireAdminApi();accepted=true}catch{}return {observed:{databaseAdmin:false,accepted},secure:!accepted,characterize:!accepted};});
await check('ADMIN-03','Database outage must fail closed even with prior admin metadata',async()=>{
 const c=client({...D,app_metadata:{role:'admin'}},{rpcError:{message:'fixture outage'}});const m=await load('src/lib/auth/require-admin-api.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}});let accepted=false;try{await m.exports.requireAdminApi();accepted=true}catch{}return {observed:{accepted},secure:!accepted,characterize:!accepted};});
await check('OAUTH-01','Local return accepted; external callback return denied',async()=>{
 const m=await load('src/app/auth/callback/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>({data:{user:A,session:{access_token:'fixture'}},error:null})}})}} ,{NEXT_PUBLIC_APP_URL:'https://lerna.fixture.invalid'});
 const request=next=>{const url='https://lerna.fixture.invalid/auth/callback?code=SYNTHETIC_CODE_ONLY&next='+encodeURIComponent(next);return {url,nextUrl:new URL(url),cookies:{get:()=>undefined,getAll:()=>[]}}};
 const own=await m.exports.GET(request('/chat'));const other=await m.exports.GET(request('https://redirect.fixture.invalid/landing'));return {observed:{ownOrigin:new URL(own.headers.get('location')).origin,otherOrigin:new URL(other.headers.get('location')).origin},secure:new URL(own.headers.get('location')).origin==='https://lerna.fixture.invalid'&&new URL(other.headers.get('location')).origin==='https://lerna.fixture.invalid',characterize:new URL(other.headers.get('location')).origin==='https://lerna.fixture.invalid'};});
await check('OAUTH-02','Callback must not log authorization codes',async()=>{
 const m=await load('src/app/auth/callback/route.ts',{'@/lib/supabase/server':{}},{NEXT_PUBLIC_APP_URL:'https://lerna.fixture.invalid'});const url='https://lerna.fixture.invalid/auth/callback?code=SECURITY_FIXTURE_SECRET_CODE&error=fixture';await m.exports.GET({url,nextUrl:new URL(url),cookies:{get:()=>undefined,getAll:()=>[]}});const leaks=JSON.stringify(m.logs).includes('SECURITY_FIXTURE_SECRET_CODE');return {observed:{syntheticCodeLogged:leaks},secure:!leaks,characterize:!leaks};});
await check('OAUTH-03','Existing sanitizer rejects external, protocol-relative and backslash returns',async()=>{
 const m=await load('src/lib/auth/return-path.ts');const f=m.exports.sanitizeAuthReturnPath;const valid=f('/chat?fixture=1');const bad=['https://redirect.fixture.invalid','//redirect.fixture.invalid','/\\redirect.fixture.invalid','/\n/redirect.fixture.invalid'].map(x=>f(x));return {observed:{valid,bad},secure:valid==='/chat?fixture=1'&&bad.every(x=>x==='/chat')};});
await check('QUOTA-01','Quota service must deny on backend outage',async()=>{
 const good=await load('src/lib/services/quota.ts',{'@/lib/repositories/billing':{},'./business':{getUserQuotaUsage:async()=>({limits:{aiRequests:2},usage:{aiRequests:0}})}});const positive=await good.exports.checkQuota(A.id,'aiRequests');const m=await load('src/lib/services/quota.ts',{'@/lib/repositories/billing':{},'./business':{getUserQuotaUsage:async()=>{throw Error('fixture outage')}}});let r;try{r=await m.exports.checkQuota(A.id,'aiRequests')}catch{r={allowed:false}}return {observed:{positiveAllowed:positive.allowed,allowed:r.allowed},secure:positive.allowed&&!r.allowed,characterize:positive.allowed&&!r.allowed};});
await check('COST-01','Demo limiter positive 200 and negative 429; header and instance reset bypass',async()=>{
 let calls=0;const demoState={count:0};const c=client(null,{demoState});const imports={'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>c},'@/lib/env':{env:{GEMINI_API_KEY:'fixture-key'}},'@google/genai':{GoogleGenAI:class{models={generateContent:async()=>{calls++;return {text:'SECURITY_FIXTURE_MODEL'};}}}}};const m=await load('src/app/api/demo-chat/route.ts',imports);const statuses=[];for(let i=0;i<11;i++)statuses.push((await m.exports.POST(req(undefined,{message:'fixture'},{'x-forwarded-for':'192.0.2.1'}))).status);const rotated=(await m.exports.POST(req(undefined,{message:'fixture'},{'x-forwarded-for':'192.0.2.2'}))).status;const fresh=await load('src/app/api/demo-chat/route.ts',imports);const reset=(await fresh.exports.POST(req(undefined,{message:'fixture'},{'x-forwarded-for':'192.0.2.1'}))).status;return {observed:{first:statuses[0],eleventh:statuses[10],rotated,otherInstance:reset,modelMockCalls:calls},secure:statuses[0]===200&&statuses[10]===429&&rotated===429&&reset===429,characterize:statuses[0]===200&&statuses[10]===429&&rotated===429&&reset===429};});
await check('UPLOAD-01','Foreign session and unsupported MIME must stop before storage and processing',async()=>{
 const c=client(A);let processed=0;const m=await load('src/app/api/upload/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>c},'@/lib/materials/ingestion':{processMaterial:async()=>{processed++;return {id:MA}}}});const request=(session,name,mime)=>{const form=new FormData();form.set('sessionId',session);form.set('file',new File([new TextEncoder().encode('SECURITY_FIXTURE')],name,{type:mime}));return new Request('https://lerna.fixture.invalid/api/upload',{method:'POST',body:form});};const own=await m.exports.POST(request(SA,'SECURITY_FIXTURE_A.txt','text/plain'));c.effects.length=0;const other=await m.exports.POST(request(SB,'SECURITY_FIXTURE_A.bin','application/x-fixture-unsupported'));return {observed:{own:own.status,other:other.status,storageWrites:c.effects.filter(e=>e.op==='storage-upload').length,processingCalls:processed},secure:own.status===200&&other.status>=400&&c.effects.length===0,characterize:own.status===200&&other.status>=400&&c.effects.length===0};});
await check('QUIZ-01','Client-reported impossible score must be rejected',async()=>{
 const c=client(A);const m=await load('src/app/api/quiz/route.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c}});const own=await m.exports.POST(req(undefined,{title:'SECURITY_FIXTURE',score:0,totalQuestions:1,questions:[{questionText:'fixture',correctAnswer:'a',userAnswer:'b',options:['a','b'],isCorrect:false}]}));const forged=await m.exports.POST(req(undefined,{title:'SECURITY_FIXTURE',score:999,totalQuestions:1,questions:[]}));return {observed:{own:own.status,forged:forged.status,savedScore:c.tables.quizzes.at(-1)?.score},secure:own.status===200&&forged.status===400,characterize:own.status===200&&forged.status===400};});
await check('DELETE-01','Elastic deletion failure must propagate or durably enqueue retry',async()=>{
 let attempts=0;const good=await load('src/lib/materials/elastic.ts',{'@/lib/elastic/client':{deleteByQuery:async()=>({deleted:1})},'@/lib/gemini/client':{EMBEDDING_DIMENSIONS:768}});await good.exports.deleteMaterialFromElastic(MA,A.id);const m=await load('src/lib/materials/elastic.ts',{'@/lib/elastic/client':{deleteByQuery:async()=>{attempts++;throw Error('fixture unavailable')}},'@/lib/gemini/client':{EMBEDDING_DIMENSIONS:768}});let rejected=false;try{await m.exports.deleteMaterialFromElastic(MA,A.id)}catch{rejected=true}return {observed:{attempts,rejected},secure:rejected,characterize:rejected};});
await check('RAG-01','Tenant filter precedes search even with foreign document ID',async()=>{
 let captured;const m=await load('src/lib/materials/elastic.ts',{'@/lib/elastic/client':{createIndexIfMissing:async()=>{},searchIndex:async(i,q)=>{captured=q;return {hits:{hits:[]}}}},'@/lib/gemini/client':{EMBEDDING_DIMENSIONS:768}});await m.exports.searchMaterialEmbeddings({userId:A.id,documentIds:[MB],queryEmbedding:[0,1]});const filters=captured.knn.filter;return {observed:{hasTrustedTenant:filters.some(f=>f.term?.user_id===A.id),hasMaterialFilter:filters.some(f=>f.terms?.document_id?.includes(MB))},secure:filters.some(f=>f.term?.user_id===A.id)&&filters.some(f=>f.terms?.document_id?.includes(MB))};});
await check('RAG-02','Explicit empty authorized set must not expand to all user materials',async()=>{
 const searches=[];const c=client(A);const m=await load('src/lib/materials/retrieval.ts',{'@/lib/supabase/server':{createSupabaseServerClient:async()=>c},'@/lib/gemini/client':{generateEmbedding:async()=>[0,1]},'./elastic':{searchMaterialEmbeddings:async q=>{searches.push(q);return []}}});await m.exports.retrieveMaterialContext({userId:A.id,sessionId:SA,query:'fixture',documentIds:[]});return {observed:{searchCount:searches.length,unscopedFallback:searches.some(q=>!q.sessionId)},secure:searches.length===0,characterize:searches.length===0};});
const errors=rows.filter(x=>x.result!=='PASS');console.log(JSON.stringify({mode,environment:'dependency-mocked VM; synthetic fixtures only; zero provider calls',tests:rows,summary:{total:rows.length,passed:rows.length-errors.length,failed:errors.length,secureExpectationsMet:rows.filter(x=>x.secureExpectationMet).length}},null,2));if(errors.length)process.exitCode=1;
