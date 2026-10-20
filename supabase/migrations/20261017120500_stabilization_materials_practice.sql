create table if not exists private.material_processing_claims(material_id uuid primary key references public.uploaded_materials(id) on delete cascade,user_id uuid not null,claim_id uuid not null,expires_at timestamptz not null);
create table if not exists private.material_cleanup_jobs(material_id uuid primary key,user_id uuid not null,storage_path text not null,remove_storage boolean not null,revision bigint not null default 1,attempts int not null default 0,next_attempt_at timestamptz not null default now(),last_error_code text,created_at timestamptz not null default now());
create index if not exists cleanup_jobs_due_idx on private.material_cleanup_jobs(next_attempt_at,material_id);
-- All material mutations enter the bounded, reserved server workflow. Signed downloads remain owner-scoped.
revoke insert,update,delete on public.uploaded_materials from authenticated;
create policy stabilization_material_storage_insert on storage.objects as restrictive for insert to authenticated with check (bucket_id<>'uploaded-materials');
create policy stabilization_material_storage_update on storage.objects as restrictive for update to authenticated using (bucket_id<>'uploaded-materials') with check (bucket_id<>'uploaded-materials');
create policy stabilization_material_storage_delete on storage.objects as restrictive for delete to authenticated using (bucket_id<>'uploaded-materials');
do $$ begin
  if exists(select 1 from public.uploaded_materials group by user_id,storage_path having count(*)>1) then raise exception 'Material storage-path duplicate preflight required; preserve IDs and reconcile before migration'; end if;
end $$;
create unique index if not exists materials_owned_storage_path_idx on public.uploaded_materials(user_id,storage_path);
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg','image/webp'] where id='uploaded-materials';
create or replace function public.claim_material_processing(p_material_id uuid,p_claim_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare material public.uploaded_materials; claim private.material_processing_claims;
begin
  if not public.is_active_user(auth.uid()) or p_claim_id is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(917214);
  select * into material from public.uploaded_materials where id=p_material_id and user_id=auth.uid() and deleted_at is null for update;
  if not found then raise insufficient_privilege; end if;
  if material.status='ready' then return 'ready'; end if;
  select * into claim from private.material_processing_claims where material_id=p_material_id;
  if found and claim.expires_at>clock_timestamp() then return 'busy'; end if;
  if (select count(*) from private.material_processing_claims where expires_at>clock_timestamp())>=4 or (select count(*) from private.material_processing_claims where user_id=auth.uid() and expires_at>clock_timestamp())>=2 then return 'busy'; end if;
  insert into private.material_processing_claims values(p_material_id,auth.uid(),p_claim_id,clock_timestamp()+interval '5 minutes') on conflict(material_id) do update set claim_id=excluded.claim_id,expires_at=excluded.expires_at;
  update public.uploaded_materials set status='processing',error_message=null where id=p_material_id;
  return 'claimed';
end $$;
create or replace function public.finish_material_processing(p_material_id uuid,p_claim_id uuid,p_status text,p_values jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare material public.uploaded_materials; k text; claim private.material_processing_claims;
begin
  select * into claim from private.material_processing_claims where material_id=p_material_id and claim_id=p_claim_id;
  if not found or not public.is_active_user(claim.user_id) or p_status not in ('ready','failed') or p_status is null then raise insufficient_privilege; end if;
  select * into material from public.uploaded_materials where id=p_material_id and user_id=claim.user_id and deleted_at is null for update;
  if not found then return false; end if;
  if claim.expires_at<=clock_timestamp() then return false; end if;
  for k in select jsonb_object_keys(p_values) loop if k not in ('ocr_status','embedding_status','error_message','processed_at','chunk_count','summary','source_metadata') then raise exception 'Invalid processing metadata'; end if; end loop;
  if coalesce((p_values->>'chunk_count')::int,0) not between 0 and 64 or length(coalesce(p_values->>'summary',''))>20000 or octet_length(coalesce(p_values->'source_metadata','{}')::text)>2048 then raise exception 'Processing output limit'; end if;
  update public.uploaded_materials set status=p_status,ocr_status=case when p_status='ready' then 'completed' else 'failed' end,embedding_status=case when p_status='ready' then 'completed' else 'failed' end,
    error_message=case when p_status='failed' then left(coalesce(p_values->>'error_message','PROCESSING_FAILED'),200) else null end,
    processed_at=case when p_status='ready' then clock_timestamp() else processed_at end,chunk_count=coalesce((p_values->>'chunk_count')::int,0),summary=p_values->>'summary',source_metadata=coalesce(p_values->'source_metadata','{}') where id=p_material_id;
  delete from private.material_processing_claims where material_id=p_material_id and claim_id=p_claim_id;
  return true;
end $$;
create or replace function public.delete_material_and_enqueue_cleanup(p_material_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare material public.uploaded_materials;
begin
  if not public.is_active_user(auth.uid()) then raise insufficient_privilege; end if;
  select * into material from public.uploaded_materials where id=p_material_id and user_id=auth.uid() for update;
  if not found then return null; end if;
  update public.uploaded_materials set deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_material_id;
  insert into private.material_cleanup_jobs(material_id,user_id,storage_path,remove_storage) values(material.id,material.user_id,material.storage_path,true)
  on conflict(material_id) do update set remove_storage=true,revision=private.material_cleanup_jobs.revision+1,next_attempt_at=now(),last_error_code=null;
  return jsonb_build_object('id',material.id,'storage_path',material.storage_path,'cleanup_revision',(select revision from private.material_cleanup_jobs where material_id=material.id));
end $$;
create or replace function public.queue_material_index_cleanup(p_material_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare material public.uploaded_materials;
begin
  if not public.is_active_user(auth.uid()) then raise insufficient_privilege; end if;
  select * into material from public.uploaded_materials where id=p_material_id and user_id=auth.uid() for update;
  if not found then return false; end if;
  insert into private.material_cleanup_jobs(material_id,user_id,storage_path,remove_storage) values(material.id,material.user_id,material.storage_path,material.deleted_at is not null)
  on conflict(material_id) do update set remove_storage=private.material_cleanup_jobs.remove_storage or excluded.remove_storage,revision=private.material_cleanup_jobs.revision+1,next_attempt_at=now();
  return true;
end $$;
create or replace function public.complete_material_cleanup(p_material_id uuid,p_expected_revision bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_expected_revision is null then raise sqlstate 'PT428' using message='CLEANUP_REVISION_REQUIRED'; end if;
  delete from private.material_cleanup_jobs where material_id=p_material_id and revision=p_expected_revision; return found;
end $$;
revoke all on function public.claim_material_processing(uuid,uuid),public.finish_material_processing(uuid,uuid,text,jsonb),public.delete_material_and_enqueue_cleanup(uuid),public.queue_material_index_cleanup(uuid),public.complete_material_cleanup(uuid,bigint) from public,anon;
grant execute on function public.claim_material_processing(uuid,uuid),public.finish_material_processing(uuid,uuid,text,jsonb),public.delete_material_and_enqueue_cleanup(uuid),public.queue_material_index_cleanup(uuid) to authenticated;
grant execute on function public.complete_material_cleanup(uuid,bigint) to service_role;
revoke execute on function public.complete_material_cleanup(uuid,bigint) from authenticated;
revoke execute on function public.finish_material_processing(uuid,uuid,text,jsonb) from authenticated;
grant execute on function public.finish_material_processing(uuid,uuid,text,jsonb) to service_role;

alter table public.quizzes add column if not exists result_source text not null default 'legacy_unverified',add column if not exists submission_operation_id uuid;
create unique index if not exists quiz_submission_operation_idx on public.quizzes(user_id,submission_operation_id) where submission_operation_id is not null;
-- Keep the opaque receipt after an owner deletes a result. Deletion must not reset
-- the submission budget or allow the same operation to create a second result.
create table if not exists private.practice_receipts(user_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,payload_hash text not null,quiz_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,operation_id));
create index if not exists practice_receipts_budget_idx on private.practice_receipts(user_id,created_at);
create or replace function public.save_practice_quiz(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); operation uuid := (p_payload->>'operation_id')::uuid; course uuid := (p_payload->>'course_id')::uuid; material uuid := (p_payload->>'material_id')::uuid; quiz uuid; q jsonb; total int; correct int:=0; fingerprint text; receipt private.practice_receipts; lim jsonb;
begin
  if not public.is_active_user(actor) or operation is null then raise insufficient_privilege; end if;
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>200000 or jsonb_typeof(p_payload->'questions') is distinct from 'array' then raise exception 'Invalid practice submission'; end if;
  if jsonb_typeof(p_payload->'total_questions') is distinct from 'number' or coalesce(p_payload->>'total_questions','') !~ '^[0-9]{1,3}$'
     or jsonb_typeof(p_payload->'score') is distinct from 'number' or coalesce(p_payload->>'score','') !~ '^[0-9]{1,3}$'
     or jsonb_typeof(p_payload->'title') is distinct from 'string' or jsonb_typeof(p_payload->'type') is distinct from 'string' then raise exception 'Invalid practice fields'; end if;
  total := jsonb_array_length(p_payload->'questions');
  if total not between 1 and 100 or total<>(p_payload->>'total_questions')::int or p_payload->>'type' not in ('mcq','flashcard','short_answer') or length(p_payload->>'title') not between 1 and 200 then raise exception 'Invalid practice fields'; end if;
  if course is not null and not exists(select 1 from public.courses where id=course and user_id=actor) then raise insufficient_privilege; end if;
  if material is not null and not exists(select 1 from public.uploaded_materials where id=material and user_id=actor and deleted_at is null and status='ready' and (course is null or course_id=course)) then raise insufficient_privilege; end if;
  for q in select value from jsonb_array_elements(p_payload->'questions') loop
    if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(q->'question_text') is distinct from 'string' or jsonb_typeof(q->'correct_answer') is distinct from 'string'
       or length(q->>'question_text') not between 1 and 5000 or length(q->>'correct_answer') not between 1 and 2000 or jsonb_typeof(q->'is_correct') is distinct from 'boolean' then raise exception 'Invalid question'; end if;
    if (q->>'is_correct')::boolean is distinct from (coalesce(q->>'user_answer','')=q->>'correct_answer') then raise exception 'Impossible practice answer'; end if;
    if (q->>'is_correct')::boolean then correct:=correct+1; end if;
  end loop;
  if (p_payload->>'score')::int<>round(correct*100.0/total) then raise exception 'Impossible practice score'; end if;
  if coalesce((p_payload->>'time_spent')::int,0) not between 0 and 86400 then raise exception 'Invalid practice duration'; end if;
  fingerprint := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text||operation::text,2));
  select * into receipt from private.practice_receipts where user_id=actor and operation_id=operation;
  if found then
    if receipt.payload_hash<>fingerprint then raise sqlstate 'PT409' using message='OPERATION_ID_REUSED'; end if;
    if not exists(select 1 from public.quizzes where id=receipt.quiz_id and user_id=actor) then raise sqlstate 'PT410' using message='PRACTICE_RESULT_DELETED'; end if;
    return receipt.quiz_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  select l.limits into lim from private.plan_operation_limits l where l.plan=coalesce((select s.plan from public.subscriptions s where s.user_id=actor and s.status in ('active','trialing')),'free');
  if lim is null then raise exception 'Practice budget unavailable'; end if;
  if (select count(*) from private.practice_receipts where user_id=actor and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')
     + (select count(*) from public.quizzes where user_id=actor and submission_operation_id is null and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')
     + (select coalesce(sum(amount),0) from private.operation_reservations where user_id=actor and resource='quizzes' and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' and state in ('pending','unknown','succeeded')) >= (lim->>'quizzes')::int then raise sqlstate 'PT429' using message='PRACTICE_LIMIT_REACHED'; end if;
  insert into public.quizzes(user_id,course_id,material_id,title,score,total_questions,type,time_spent,difficulty,topic,result_source,submission_operation_id)
  values(actor,course,material,p_payload->>'title',(p_payload->>'score')::int,total,p_payload->>'type',(p_payload->>'time_spent')::int,p_payload->>'difficulty',p_payload->>'topic','client_reported_practice',operation) returning id into quiz;
  for q in select value from jsonb_array_elements(p_payload->'questions') loop
    insert into public.quiz_questions(quiz_id,question,question_text,options,correct_answer,explanation,user_answer,is_correct)
    values(quiz,q->>'question_text',q->>'question_text',coalesce(q->'options','[]'),q->>'correct_answer',q->>'explanation',q->>'user_answer',(q->>'is_correct')::boolean);
  end loop;
  insert into private.practice_receipts(user_id,operation_id,payload_hash,quiz_id) values(actor,operation,fingerprint,quiz);
  return quiz;
end $$;
revoke all on function public.save_practice_quiz(jsonb) from public,anon;
grant execute on function public.save_practice_quiz(jsonb) to authenticated;
-- Prevent ordinary JWTs from claiming their submitted keys constitute verified assessment.
revoke insert,update on public.quizzes,public.quiz_questions from authenticated;
