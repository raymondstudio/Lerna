-- Durable reservations are service-only. Ordinary JWTs cannot finalize/release paid work.
alter table public.ai_requests add column if not exists operation_id uuid,
  add column if not exists authoritative_outcome text not null default 'legacy_unverified',
  add column if not exists cost_status text not null default 'legacy_unverified';
alter table public.ai_requests alter column estimated_cost drop not null;
create unique index if not exists ai_requests_operation_idx on public.ai_requests(operation_id) where operation_id is not null;
create table if not exists private.operation_reservations (
  id uuid primary key,user_id uuid references auth.users(id) on delete cascade,
  resource text not null,amount bigint not null check(amount>0),bytes bigint not null default 0 check(bytes>=0),
  model text,request_type text,provider_mode text not null default 'live' check(provider_mode in ('live','mock')),
  state text not null default 'pending' check(state in ('pending','succeeded','failed','unknown','simulated','released')),
  created_at timestamptz not null default clock_timestamp(),finished_at timestamptz
);
create index if not exists operations_actor_window_idx on private.operation_reservations(user_id,created_at,state);
create table if not exists private.plan_operation_limits(plan text primary key,limits jsonb not null);
insert into private.plan_operation_limits values
('free','{"aiRequests":100,"dailyRequests":20,"uploads":10,"storage":52428800,"quizzes":20,"flashcards":50,"ocrPages":5,"voiceSeconds":120}'),
('student','{"aiRequests":500,"dailyRequests":50,"uploads":50,"storage":524288000,"quizzes":50,"flashcards":150,"ocrPages":20,"voiceSeconds":600}'),
('pro','{"aiRequests":2000,"dailyRequests":200,"uploads":200,"storage":2147483648,"quizzes":200,"flashcards":500,"ocrPages":100,"voiceSeconds":3600}'),
('premium','{"aiRequests":2000,"dailyRequests":200,"uploads":200,"storage":2147483648,"quizzes":200,"flashcards":500,"ocrPages":100,"voiceSeconds":3600}'),
('team','{"aiRequests":10000,"dailyRequests":1000,"uploads":1000,"storage":10737418240,"quizzes":1000,"flashcards":5000,"ocrPages":1000,"voiceSeconds":36000}'),
('enterprise','{"aiRequests":10000,"dailyRequests":1000,"uploads":1000,"storage":10737418240,"quizzes":1000,"flashcards":5000,"ocrPages":1000,"voiceSeconds":36000}')
on conflict(plan) do nothing;
create or replace function public.reserve_operation(p_id uuid,p_user_id uuid,p_resource text,p_amount bigint default 1,p_bytes bigint default 0,p_model text default null,p_request_type text default null,p_provider_mode text default 'live') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lim jsonb; month_start timestamptz := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'; day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'; used bigint; pending bigint; daily bigint; total_bytes bigint; existing private.operation_reservations;
begin
  if not public.is_active_user(p_user_id) then raise insufficient_privilege using message='ACTIVE_ACCOUNT_REQUIRED'; end if;
  if p_resource not in ('aiRequests','uploads','quizzes','flashcards','ocrPages','voiceSeconds') or p_amount not between 1 and 1000 or p_bytes not between 0 and 20971520 or p_provider_mode not in ('live','mock') then raise exception 'Invalid reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  select * into existing from private.operation_reservations where id=p_id;
  if found then
    if existing.user_id<>p_user_id or existing.resource<>p_resource or existing.amount<>p_amount or existing.bytes<>p_bytes or existing.model is distinct from p_model or existing.request_type is distinct from p_request_type or existing.provider_mode<>p_provider_mode then raise sqlstate 'PT409' using message='OPERATION_ID_REUSED'; end if;
    return jsonb_build_object('id',existing.id,'state',existing.state,'replayed',true);
  end if;
  select l.limits into lim from private.plan_operation_limits l where l.plan=coalesce((select s.plan from public.subscriptions s where s.user_id=p_user_id and s.status in ('active','trialing')),'free');
  if lim is null then raise exception 'Budget configuration unavailable'; end if;
  select coalesce(sum(amount),0) into pending from private.operation_reservations where user_id=p_user_id and resource=p_resource and created_at>=month_start and state in ('pending','unknown','succeeded') and (p_resource<>'uploads' or state<>'succeeded');
  used := 0;
  if p_resource='uploads' then select count(*) into used from public.uploaded_materials where user_id=p_user_id and deleted_at is null;
  elsif p_resource='aiRequests' then select count(*) into used from public.ai_requests where user_id=p_user_id and created_at>=month_start and operation_id is null;
  elsif p_resource='quizzes' then
    select (select count(*) from private.practice_receipts where user_id=p_user_id and created_at>=month_start)
      +(select count(*) from public.quizzes where user_id=p_user_id and created_at>=month_start and submission_operation_id is null) into used;
  elsif p_resource='ocrPages' then select coalesce(sum(ocr_pages),0) into used from public.subscription_usage where user_id=p_user_id and usage_date>=month_start::date;
  elsif p_resource='voiceSeconds' then select coalesce(sum(voice_usage_seconds),0) into used from public.subscription_usage where user_id=p_user_id and usage_date>=month_start::date;
  end if;
  if used+pending+p_amount>(lim->>p_resource)::bigint then raise sqlstate 'PT429' using message='QUOTA_EXHAUSTED'; end if;
  if p_model is not null then
    select count(*) into used from public.ai_requests where user_id=p_user_id and operation_id is null and created_at>=month_start;
    select count(*) into pending from private.operation_reservations where user_id=p_user_id and model is not null and created_at>=month_start and state in ('pending','unknown','succeeded');
    select (select count(*) from public.ai_requests where user_id=p_user_id and operation_id is null and created_at>=day_start)+(select count(*) from private.operation_reservations where user_id=p_user_id and model is not null and created_at>=day_start and state in ('pending','unknown','succeeded')) into daily;
    if used+pending+1>(lim->>'aiRequests')::bigint or daily+1>(lim->>'dailyRequests')::bigint then raise sqlstate 'PT429' using message='AI_QUOTA_EXHAUSTED'; end if;
  end if;
  if p_resource='uploads' then
    select coalesce(sum(file_size),0) into total_bytes from public.uploaded_materials where user_id=p_user_id and deleted_at is null;
    select coalesce(sum(bytes),0) into pending from private.operation_reservations where user_id=p_user_id and resource='uploads' and state in ('pending','unknown');
    if total_bytes+pending+p_bytes>(lim->>'storage')::bigint then raise sqlstate 'PT429' using message='STORAGE_QUOTA_EXHAUSTED'; end if;
  end if;
  insert into private.operation_reservations(id,user_id,resource,amount,bytes,model,request_type,provider_mode) values(p_id,p_user_id,p_resource,p_amount,p_bytes,p_model,p_request_type,p_provider_mode);
  if p_model is not null then perform private.append_event(jsonb_build_object('user_id',p_user_id,'event_type','ai.request.started','category','ai','outcome','pending','source','server','activity_id',p_id,'dedup_key','ai:start:'||p_id,'properties',jsonb_build_object('model',p_model,'request_type',p_request_type,'provider_mode',p_provider_mode))); end if;
  return jsonb_build_object('id',p_id,'state','pending','replayed',false);
end $$;
create or replace function public.finish_operation(p_id uuid,p_state text,p_metrics jsonb default '{}') returns boolean
language plpgsql security definer set search_path = '' as $$
declare op private.operation_reservations; meta jsonb; event_name text; priced boolean;
begin
  if p_state not in ('succeeded','failed','unknown','simulated','released') then raise exception 'Invalid operation state'; end if;
  select * into strict op from private.operation_reservations where id=p_id for update;
  if op.state=p_state then return true; end if;
  if op.state<>'pending' then raise sqlstate 'PT409' using message='OPERATION_ALREADY_FINALIZED'; end if;
  if op.provider_mode='mock' and p_state='succeeded' then raise exception 'Simulated provider cannot report success'; end if;
  update private.operation_reservations set state=p_state,finished_at=clock_timestamp() where id=p_id;
  if op.model is not null and p_state<>'released' then
    meta := jsonb_build_object('model',op.model,'request_type',op.request_type,'provider_mode',op.provider_mode);
    if p_state in ('succeeded','simulated') then
      event_name := 'ai.request.completed';
      meta := meta || jsonb_build_object('prompt_tokens',greatest(0,least(10000000,coalesce((p_metrics->>'promptTokens')::int,0))),'completion_tokens',greatest(0,least(1000000,coalesce((p_metrics->>'completionTokens')::int,0))),'duration_ms',greatest(0,least(600000,coalesce((p_metrics->>'durationMs')::int,0))),'token_source',coalesce(p_metrics->>'tokenSource','unavailable'));
    else event_name := 'ai.request.failed'; meta := meta||jsonb_build_object('error_code',case when p_state='unknown' then 'PROVIDER_OUTCOME_UNKNOWN' else 'PROVIDER_FAILED' end); end if;
    perform private.append_event(jsonb_build_object('user_id',op.user_id,'event_type',event_name,'category','ai','outcome',p_state,'source','provider','activity_id',p_id,'dedup_key','ai:terminal:'||p_id,'properties',meta));
    -- Keep decided, unknown and simulated rows distinct. Price only known standard
    -- Gemini 2.5 Flash usage; unavailable estimates remain NULL rather than free.
    priced := p_state='succeeded' and op.provider_mode='live' and op.model='gemini-2.5-flash' and meta->>'token_source'='provider';
    insert into public.ai_requests(user_id,prompt_tokens,completion_tokens,total_tokens,model_used,request_type,status,operation_id,authoritative_outcome,latency_ms,estimated_cost,input_rate_per_million,output_rate_per_million,pricing_currency,pricing_version,cost_status)
    values(op.user_id,coalesce((meta->>'prompt_tokens')::int,0),coalesce((meta->>'completion_tokens')::int,0),coalesce((meta->>'prompt_tokens')::int,0)+coalesce((meta->>'completion_tokens')::int,0),op.model,op.request_type,case when p_state='succeeded' then 'success' else p_state end,p_id,p_state,(p_metrics->>'durationMs')::int,
      case when priced then round(((meta->>'prompt_tokens')::numeric*0.30+(meta->>'completion_tokens')::numeric*2.50)/1000000,6) else null end,
      case when priced then 0.30 else null end,case when priced then 2.50 else null end,'USD',case when priced then 'google-standard-2026-10-18' else 'unavailable' end,case when priced then 'estimated' else 'unavailable' end);
  end if;
  return true;
end $$;
revoke all on function public.reserve_operation(uuid,uuid,text,bigint,bigint,text,text,text),public.finish_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_operation(uuid,uuid,text,bigint,bigint,text,text,text),public.finish_operation(uuid,text,jsonb) to service_role;

-- Anonymous demonstrations share a conservative distributed budget. Client IP headers are never trusted.
create table if not exists private.demo_budget(window_start timestamptz primary key,count int not null);
create or replace function public.reserve_demo_operation(p_id uuid,p_model text,p_request_type text,p_provider_mode text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare minute_count int; day_count int;
begin
  perform pg_advisory_xact_lock(917212);
  select coalesce(sum(count),0) into day_count from private.demo_budget where window_start>=date_trunc('day',now());
  if day_count>=100 then return false; end if;
  select coalesce(count,0) into minute_count from private.demo_budget where window_start=date_trunc('minute',now());
  if minute_count>=10 then return false; end if;
  insert into private.demo_budget values(date_trunc('minute',now()),1) on conflict(window_start) do update set count=private.demo_budget.count+1;
  insert into private.operation_reservations(id,resource,amount,model,request_type,provider_mode) values(p_id,'aiRequests',1,p_model,p_request_type,p_provider_mode);
  perform private.append_event(jsonb_build_object('event_type','ai.request.started','category','ai','outcome','pending','source','server','actor_type','anonymous','activity_id',p_id,'dedup_key','ai:start:'||p_id,'properties',jsonb_build_object('model',p_model,'request_type',p_request_type,'provider_mode',p_provider_mode)));
  return true;
end $$;
revoke all on function public.reserve_demo_operation(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_demo_operation(uuid,text,text,text) to service_role;
