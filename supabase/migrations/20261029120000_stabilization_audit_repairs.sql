-- Additive audit repairs: align feedback/broadcast/coupon/institution privileges,
-- enforce entry-level AAL2 + target validation on legacy SECURITY DEFINER admin RPCs,
-- remove legacy v0 event pollution and profile-name PII in audit_logs, and emit
-- v1 upload/recovery lifecycle events.

drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback
  for update to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

grant update on table public.feedback to authenticated;
grant insert, update, delete on table public.broadcasts to authenticated;

drop policy if exists coupons_admin_all on public.coupon_codes;
create policy coupons_admin_all on public.coupon_codes
  for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

grant insert, update on table public.coupon_codes to authenticated;
grant update, delete on table public.institutions to authenticated;

create or replace function public.admin_toggle_suspension(target_user_id uuid, suspend_status boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  prev_suspended boolean;
begin
  perform private.require_sensitive_admin();
  if target_user_id is null or suspend_status is null then raise exception 'INVALID_SUSPENSION_REQUEST'; end if;
  perform pg_advisory_xact_lock(917210);
  select is_suspended into prev_suspended from public.profiles where id = target_user_id for update;
  if not found then raise exception 'TARGET_NOT_FOUND'; end if;
  if suspend_status and exists(select 1 from public.user_roles where user_id=target_user_id and role='owner')
     and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.role='owner' and r.user_id<>target_user_id and not p.is_suspended and not p.is_deleted) then
    raise exception 'Cannot disable final active owner';
  end if;
  update public.profiles
  set is_suspended = suspend_status,
      updated_at = clock_timestamp()
  where id = target_user_id;
  if prev_suspended is not distinct from suspend_status then
    perform private.append_event(jsonb_build_object('user_id',auth.uid(),'event_type','admin.settings.changed','category','security','outcome','succeeded','severity','warning','source','database','resource_type','profile','resource_id',target_user_id,'properties',jsonb_build_object('setting','account_status')));
  end if;
  insert into public.audit_logs(user_id, action, details)
  values(auth.uid(), case when suspend_status then 'user_suspended' else 'user_restored' end, jsonb_build_object('target_user_id', target_user_id));
  return true;
end $$;

create or replace function public.admin_toggle_soft_delete(target_user_id uuid, delete_status boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  prev_deleted boolean;
begin
  perform private.require_sensitive_admin();
  if target_user_id is null or delete_status is null then raise exception 'INVALID_DELETE_REQUEST'; end if;
  perform pg_advisory_xact_lock(917210);
  select is_deleted into prev_deleted from public.profiles where id = target_user_id for update;
  if not found then raise exception 'TARGET_NOT_FOUND'; end if;
  if delete_status and exists(select 1 from public.user_roles where user_id=target_user_id and role='owner')
     and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.role='owner' and r.user_id<>target_user_id and not p.is_suspended and not p.is_deleted) then
    raise exception 'Cannot disable final active owner';
  end if;
  update public.profiles
  set is_deleted = delete_status,
      deleted_at = case when delete_status then coalesce(deleted_at, now()) else null end,
      updated_at = clock_timestamp()
  where id = target_user_id;
  if prev_deleted is not distinct from delete_status then
    perform private.append_event(jsonb_build_object('user_id',auth.uid(),'event_type','admin.settings.changed','category','security','outcome','succeeded','severity','warning','source','database','resource_type','profile','resource_id',target_user_id,'properties',jsonb_build_object('setting','account_status')));
  end if;
  insert into public.audit_logs(user_id, action, details)
  values(auth.uid(), case when delete_status then 'user_soft_deleted' else 'user_restored' end, jsonb_build_object('target_user_id', target_user_id));
  return true;
end $$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  return public.admin_toggle_soft_delete(target_user_id, true);
end $$;

create or replace function public.admin_assign_plan(
  target_user_id uuid,
  new_plan text,
  plan_status text default 'active',
  is_promo boolean default false
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  period_end timestamptz;
begin
  perform private.require_sensitive_admin();
  if target_user_id is null or not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'TARGET_NOT_FOUND'; end if;
  if new_plan is null or new_plan not in ('free', 'student', 'pro', 'team', 'premium', 'enterprise') then raise exception 'INVALID_PLAN'; end if;
  if plan_status is null or plan_status not in ('active', 'inactive', 'canceled', 'past_due', 'paused', 'trialing') then raise exception 'INVALID_PLAN_STATUS'; end if;
  if is_promo is null then raise exception 'INVALID_PROMO_FLAG'; end if;
  period_end := case when is_promo then now() + interval '30 days' else now() + interval '1 year' end;
  insert into public.subscriptions (
    user_id, plan, status, current_period_start, current_period_end, payment_provider, updated_at
  )
  values (
    target_user_id, new_plan, plan_status, now(), period_end, case when is_promo then 'promo' else 'manual' end, clock_timestamp()
  )
  on conflict (user_id) do update
  set plan = excluded.plan,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      payment_provider = excluded.payment_provider,
      updated_at = clock_timestamp();
  insert into public.audit_logs (user_id, action, details)
  values (
    auth.uid(),
    'plan_assigned',
    jsonb_build_object('target_user_id', target_user_id, 'new_plan', new_plan, 'status', plan_status, 'is_promo', is_promo)
  );
  return true;
end $$;

revoke all on function public.admin_toggle_suspension(uuid,boolean),public.admin_toggle_soft_delete(uuid,boolean),public.admin_delete_user(uuid),public.admin_assign_plan(uuid,text,text,boolean) from public,anon;
grant execute on function public.admin_toggle_suspension(uuid,boolean),public.admin_toggle_soft_delete(uuid,boolean),public.admin_delete_user(uuid),public.admin_assign_plan(uuid,text,text,boolean) to authenticated;

create or replace function public.log_profile_update()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (user_id, action, details)
  values (
    new.id,
    'profile_updated',
    jsonb_build_object(
      'is_suspended_changed', old.is_suspended is distinct from new.is_suspended,
      'is_deleted_changed', old.is_deleted is distinct from new.is_deleted
    )
  );
  return new;
end $$;

create or replace function private.pseudonymize_deleted_actor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.events set user_id=case when user_id=old.id then null else user_id end,
    actor_type=case when user_id=old.id and schema_version=1 then 'system' else actor_type end,
    actor_role=case when user_id=old.id then null else actor_role end,
    resource_id=case when resource_type in ('profile','user') and resource_id=old.id then null else resource_id end,
    dedup_key=null,
    properties=case when schema_version=0 then '{}'::jsonb else properties end
  where user_id=old.id or (resource_type in ('profile','user') and resource_id=old.id);
  update public.audit_logs set
    user_id=case when user_id=old.id then null else user_id end,
    details=(details - 'old_name' - 'new_name' - 'old_institution' - 'new_institution' - 'target_user_id' - 'deleted_user_id' - 'performed_by')
  where user_id=old.id
     or details->>'target_user_id' = old.id::text
     or details->>'deleted_user_id' = old.id::text
     or details->>'performed_by' = old.id::text;
  return old;
end $$;

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
  select l.limits into lim from private.plan_operation_limits l
  where l.plan=coalesce((select s.plan from public.subscriptions s where s.user_id=p_user_id and s.status in ('active','trialing')),'free');
  if lim is null then raise exception 'Plan budget unavailable'; end if;
  select coalesce(sum(amount),0) into pending from private.operation_reservations where user_id=p_user_id and resource=p_resource and created_at>=month_start and state in ('pending','unknown','succeeded');
  used := 0;
  if p_resource='quizzes' then
    select count(*) into used from private.practice_receipts where user_id=p_user_id and created_at>=month_start;
    select used+count(*) into used from public.quizzes where user_id=p_user_id and submission_operation_id is null and created_at>=month_start;
  elsif p_resource='ocrPages' then select coalesce(sum(ocr_pages),0) into used from public.subscription_usage where user_id=p_user_id and usage_date>=month_start::date;
  elsif p_resource='voiceSeconds' then select coalesce(sum(voice_usage_seconds),0) into used from public.subscription_usage where user_id=p_user_id and usage_date>=month_start::date;
  end if;
  if p_resource<>'uploads' and used+pending+p_amount > (lim->>p_resource)::bigint then raise sqlstate 'PT429' using message='QUOTA_EXHAUSTED'; end if;
  if p_model is not null then
    select (select count(*) from public.ai_requests where user_id=p_user_id and operation_id is null and created_at>=month_start)
      + (select count(*) from private.operation_reservations where user_id=p_user_id and model is not null and created_at>=month_start and state in ('pending','unknown','succeeded')) into used;
    select (select count(*) from public.ai_requests where user_id=p_user_id and operation_id is null and created_at>=day_start)
      + (select count(*) from private.operation_reservations where user_id=p_user_id and model is not null and created_at>=day_start and state in ('pending','unknown','succeeded')) into daily;
    if used+1 > (lim->>'aiRequests')::bigint or daily+1 > (lim->>'dailyRequests')::bigint then raise sqlstate 'PT429' using message='AI_QUOTA_EXHAUSTED'; end if;
  end if;
  if p_resource='uploads' then
    select count(*),coalesce(sum(file_size),0) into used,total_bytes from public.uploaded_materials where user_id=p_user_id and deleted_at is null;
    select used+coalesce(sum(amount),0),total_bytes+coalesce(sum(bytes),0) into used,total_bytes from private.operation_reservations where user_id=p_user_id and resource='uploads' and state in ('pending','unknown');
    if used+p_amount > (lim->>'uploads')::bigint or total_bytes+p_bytes > (lim->>'storage')::bigint then raise sqlstate 'PT429' using message='UPLOAD_QUOTA_EXHAUSTED'; end if;
  end if;
  insert into private.operation_reservations(id,user_id,resource,amount,bytes,model,request_type,provider_mode) values(p_id,p_user_id,p_resource,p_amount,p_bytes,p_model,p_request_type,p_provider_mode);
  if p_model is not null then
    perform private.append_event(jsonb_build_object('user_id',p_user_id,'event_type','ai.request.started','category','ai','outcome','pending','source','server','activity_id',p_id,'dedup_key','ai:start:'||p_id,'properties',jsonb_build_object('model',p_model,'request_type',p_request_type,'provider_mode',p_provider_mode)));
  elsif p_resource='uploads' then
    perform private.append_event(jsonb_build_object('user_id',p_user_id,'event_type','material.upload.started','category','material','outcome','pending','source','server','activity_id',p_id,'dedup_key','upload:start:'||p_id,'properties',jsonb_build_object('bytes',p_bytes)));
  end if;
  return jsonb_build_object('id',p_id,'state','pending','replayed',false);
end $$;

create or replace function public.finish_operation(p_id uuid,p_state text,p_metrics jsonb default '{}') returns boolean
language plpgsql security definer set search_path = '' as $$
declare op private.operation_reservations; event_name text; meta jsonb; priced boolean;
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
    priced := p_state='succeeded' and op.provider_mode='live' and op.model='gemini-2.5-flash' and meta->>'token_source'='provider';
    insert into public.ai_requests(user_id,prompt_tokens,completion_tokens,total_tokens,model_used,request_type,status,operation_id,authoritative_outcome,latency_ms,estimated_cost,input_rate_per_million,output_rate_per_million,pricing_currency,pricing_version,cost_status)
    values(op.user_id,coalesce((meta->>'prompt_tokens')::int,0),coalesce((meta->>'completion_tokens')::int,0),coalesce((meta->>'prompt_tokens')::int,0)+coalesce((meta->>'completion_tokens')::int,0),op.model,op.request_type,case when p_state='succeeded' then 'success' else p_state end,p_id,p_state,(p_metrics->>'durationMs')::int,
      case when priced then round(((meta->>'prompt_tokens')::numeric*0.30+(meta->>'completion_tokens')::numeric*2.50)/1000000,6) else null end,
      case when priced then 0.30 else null end,case when priced then 2.50 else null end,'USD',case when priced then 'google-standard-2026-10-18' else 'unavailable' end,case when priced then 'estimated' else 'unavailable' end);
  elsif op.resource='uploads' then
    if p_state='succeeded' then
      perform private.append_event(jsonb_build_object('user_id',op.user_id,'event_type','material.upload.completed','category','material','outcome','succeeded','source','server','activity_id',p_id,'dedup_key','upload:terminal:'||p_id,'properties',jsonb_build_object('bytes',op.bytes)));
    elsif p_state in ('failed','released','unknown') then
      perform private.append_event(jsonb_build_object('user_id',op.user_id,'event_type','material.upload.failed','category','material','outcome',case when p_state='unknown' then 'unknown' else 'failed' end,'source','server','activity_id',p_id,'dedup_key','upload:terminal:'||p_id,'properties',jsonb_build_object('error_code',case when p_state='released' then 'UPLOAD_RELEASED' when p_state='unknown' then 'UPLOAD_OUTCOME_UNKNOWN' else 'UPLOAD_FAILED' end)));
    end if;
  end if;
  return true;
end $$;

revoke all on function public.reserve_operation(uuid,uuid,text,bigint,bigint,text,text,text),public.finish_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_operation(uuid,uuid,text,bigint,bigint,text,text,text),public.finish_operation(uuid,text,jsonb) to service_role;

create or replace function public.consume_recovery_proof(p_proof_hash text,p_user_id uuid,p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.recovery_proofs set consumed_at=clock_timestamp() where proof_hash=p_proof_hash and user_id=p_user_id and session_id=p_session_id and consumed_at is null and expires_at>clock_timestamp();
  if not found then return false; end if;
  perform private.append_event(jsonb_build_object('user_id',p_user_id,'event_type','auth.recovery.completed','category','auth','outcome','succeeded','source','server','dedup_key','recovery:complete:'||p_proof_hash,'properties','{}'::jsonb));
  return true;
end $$;

revoke all on function public.consume_recovery_proof(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_recovery_proof(text,uuid,uuid) to service_role;
