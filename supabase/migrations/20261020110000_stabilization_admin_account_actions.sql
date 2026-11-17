-- Keep sensitive account adjustments and their legacy audit record in one
-- transaction. The existing table triggers write the versioned event in that
-- same transaction and reject unavailable event storage.
create or replace function public.admin_reset_usage(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'UTC')::date;
begin
  perform private.require_sensitive_admin();
  if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'TARGET_NOT_FOUND'; end if;
  insert into public.subscription_usage(user_id,usage_date,ai_requests,uploads,quizzes,flashcards,ocr_pages,voice_usage_seconds)
  values(p_user_id,v_day,0,0,0,0,0,0)
  on conflict(user_id,usage_date) do update set
    ai_requests=0,uploads=0,quizzes=0,flashcards=0,ocr_pages=0,voice_usage_seconds=0,updated_at=now();
  insert into public.audit_logs(user_id,action,details)
  values(auth.uid(),'usage_reset',jsonb_build_object('target_user_id',p_user_id,'usage_date',v_day));
  return true;
end $$;

create or replace function public.admin_extend_subscription(p_user_id uuid,p_days integer) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_end timestamptz;
begin
  perform private.require_sensitive_admin();
  if p_user_id is null or p_days is null or p_days not between 1 and 366 then raise exception 'INVALID_EXTENSION'; end if;
  select greatest(coalesce(current_period_end,now()),now()) + make_interval(days=>p_days)
    into v_end from public.subscriptions where user_id=p_user_id for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  update public.subscriptions set current_period_end=v_end,updated_at=now() where user_id=p_user_id;
  insert into public.audit_logs(user_id,action,details)
  values(auth.uid(),'subscription_extended',jsonb_build_object('target_user_id',p_user_id,'days',p_days));
  return v_end;
end $$;

revoke all on function public.admin_reset_usage(uuid),public.admin_extend_subscription(uuid,integer) from public,anon;
grant execute on function public.admin_reset_usage(uuid),public.admin_extend_subscription(uuid,integer) to authenticated;
