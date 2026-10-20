-- Additive v1 activity contract. Legacy rows remain explicitly unverified (v0).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.activity_runtime (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('local','preview','staging','production')),
  release_id text not null check (length(release_id) between 1 and 100)
);
-- Deliberately no hosted default. The owner must configure this row before rollout.
alter table public.events
  add column if not exists schema_version smallint not null default 0,
  add column if not exists environment text,
  add column if not exists release_id text,
  add column if not exists category text,
  add column if not exists outcome text,
  add column if not exists severity text,
  add column if not exists occurred_at timestamptz,
  add column if not exists received_at timestamptz not null default clock_timestamp(),
  add column if not exists actor_type text,
  add column if not exists actor_role text,
  add column if not exists source text,
  add column if not exists request_id uuid,
  add column if not exists activity_id uuid,
  add column if not exists route text,
  add column if not exists resource_type text,
  add column if not exists resource_id uuid,
  add column if not exists dedup_key text;
create unique index if not exists events_environment_dedup_idx on public.events(environment,dedup_key) where dedup_key is not null;
create index if not exists events_environment_cursor_idx on public.events(environment,received_at desc,id desc);
create index if not exists events_environment_actor_cursor_idx on public.events(environment,user_id,received_at desc,id desc);
create index if not exists events_environment_category_cursor_idx on public.events(environment,category,received_at desc,id desc);
alter table public.events add constraint events_v1_contract check (schema_version = 0 or (
  schema_version = 1 and environment in ('local','preview','staging','production') and release_id is not null
  and category in ('auth','navigation','study','material','ai','security','admin') and outcome in ('attempted','pending','unknown','simulated','succeeded','failed','denied','reported')
  and severity in ('info','warning','error') and occurred_at is not null
  and actor_type in ('user','system','anonymous') and source in ('server','database','provider','browser_reported')
  and octet_length(properties::text) <= 2048
  and (route is null or (length(route)<=200 and route ~ '^/[^?#]*$'))
  and (dedup_key is null or length(dedup_key)<=200)
) is true);
revoke insert,update,delete on public.events from anon,authenticated;
drop policy if exists events_insert_all on public.events;
drop policy if exists events_admin_all on public.events;
create policy events_admin_read on public.events for select to authenticated using (public.is_admin((select auth.uid())));

create or replace function private.append_event(p_event jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r private.activity_runtime; result uuid; actor uuid; role_name text; allowed text[]; k text; meta jsonb;
begin
  select * into strict r from private.activity_runtime where singleton;
  actor := nullif(p_event->>'user_id','')::uuid;
  select role into role_name from public.user_roles where user_id=actor;
  meta := coalesce(p_event->'properties','{}');
  allowed := case p_event->>'event_type'
    when 'page.viewed' then array[]::text[] when 'study_session.opened' then array[]::text[] when 'study_session.created' then array[]::text[]
    when 'note.saved' then array['revision'] when 'note.save_failed' then array['error_code']
    when 'material.upload.started' then array['bytes'] when 'material.upload.completed' then array['bytes']
    when 'material.upload.failed' then array['error_code'] when 'material.extraction.failed' then array['error_code'] when 'material.index.failed' then array['error_code']
    when 'ai.request.started' then array['model','request_type','provider_mode']
    when 'ai.request.completed' then array['model','request_type','provider_mode','prompt_tokens','completion_tokens','duration_ms','token_source']
    when 'ai.request.failed' then array['model','request_type','provider_mode','error_code']
    when 'auth.login.succeeded' then array['provider'] when 'auth.login.failed' then array['provider','error_code']
    when 'auth.logout' then array[]::text[] when 'auth.recovery.requested' then array[]::text[] when 'auth.recovery.completed' then array[]::text[]
    when 'access.denied' then array['error_code'] when 'admin.activity.read' then array['filter_hash']
    when 'admin.activity.export' then array['filter_hash','format','rows','truncated']
    when 'admin.role.changed' then array['new_role'] when 'admin.settings.changed' then array['setting'] else null end;
  if allowed is null or jsonb_typeof(meta)<>'object' then raise exception 'Invalid event type or metadata'; end if;
  for k in select jsonb_object_keys(meta) loop
    if not k=any(allowed) then raise exception 'Unsupported event metadata'; end if;
    if k in ('revision','bytes','prompt_tokens','completion_tokens','duration_ms','rows') then
      if jsonb_typeof(meta->k)<>'number' or (meta->>k) !~ '^[0-9]{1,15}$' then raise exception 'Invalid event count'; end if;
    elsif k='truncated' then
      if jsonb_typeof(meta->k)<>'boolean' then raise exception 'Invalid event flag'; end if;
    elsif jsonb_typeof(meta->k)<>'string' or (meta->>k) !~ '^[a-zA-Z0-9_.:-]{1,100}$' then raise exception 'Invalid event code'; end if;
  end loop;
  if p_event->>'source'='browser_reported' and (p_event->>'event_type' not in ('page.viewed','study_session.opened') or p_event->>'outcome'<>'reported') then raise exception 'Invalid reported activity'; end if;
  if p_event ? 'environment' and p_event->>'environment' <> r.environment then raise exception 'Activity environment mismatch'; end if;
  insert into public.events(user_id,event_type,properties,schema_version,environment,release_id,category,outcome,severity,occurred_at,actor_type,actor_role,source,request_id,activity_id,route,resource_type,resource_id,dedup_key)
  values(actor,p_event->>'event_type',meta,1,r.environment,r.release_id,
    p_event->>'category',p_event->>'outcome',coalesce(p_event->>'severity','info'),coalesce((p_event->>'occurred_at')::timestamptz,clock_timestamp()),
    case when actor is not null then 'user' else coalesce(p_event->>'actor_type','system') end,role_name,p_event->>'source',
    (p_event->>'request_id')::uuid,(p_event->>'activity_id')::uuid,p_event->>'route',p_event->>'resource_type',(p_event->>'resource_id')::uuid,p_event->>'dedup_key')
  on conflict(environment,dedup_key) where dedup_key is not null do nothing returning id into result;
  if result is null then select id into result from public.events where environment=r.environment and dedup_key=p_event->>'dedup_key'; end if;
  return result;
end $$;
revoke all on function private.append_event(jsonb) from public,anon,authenticated;
create or replace function public.append_activity_event(p_event jsonb) returns uuid
language sql security definer set search_path = '' as $$ select private.append_event(p_event) $$;
revoke all on function public.append_activity_event(jsonb) from public,anon,authenticated;
grant execute on function public.append_activity_event(jsonb) to service_role;

create table if not exists private.activity_ingest_budget(user_id uuid primary key references auth.users(id) on delete cascade,window_start timestamptz not null,count int not null);
create or replace function public.consume_activity_ingest_budget(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare used int;
begin
  insert into private.activity_ingest_budget values(p_user_id,date_trunc('minute',clock_timestamp()),1)
  on conflict(user_id) do update set window_start=excluded.window_start,count=case when private.activity_ingest_budget.window_start=excluded.window_start then private.activity_ingest_budget.count+1 else 1 end
  returning count into used;
  return used<=30;
end $$;
revoke all on function public.consume_activity_ingest_budget(uuid) from public,anon,authenticated;
grant execute on function public.consume_activity_ingest_budget(uuid) to service_role;
create or replace function public.cleanup_activity_events(p_page_days int default 30,p_operational_days int default 90,p_batch_size int default 5000) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_page_days<30 or p_operational_days<90 or p_batch_size not between 1 and 5000 then raise exception 'Invalid retention bounds'; end if;
  with expired as (select id from public.events where schema_version=1 and received_at<clock_timestamp()-make_interval(days=>case when category='navigation' then p_page_days else p_operational_days end) order by received_at,id limit p_batch_size for update skip locked)
  delete from public.events e using expired x where e.id=x.id;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.cleanup_activity_events(int,int,int) from public,anon,authenticated;
grant execute on function public.cleanup_activity_events(int,int,int) to service_role;
