-- Read the same durable holds used by reservations. Missing storage/configuration
-- is an error, never an invented free plan or zero remaining usage.
create function public.get_operation_budget_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); plan_name text; lim jsonb; counts jsonb := '{}'; usage jsonb; remaining jsonb := '{}';
  month_start timestamptz := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  v_resource text; used bigint; held bigint; all_ai bigint; daily_ai bigint; upload_count bigint; storage_bytes bigint; quiz_count bigint;
begin
  if not public.is_active_user(actor) then raise insufficient_privilege; end if;
  select case when status in ('active','trialing') then plan else 'free' end into plan_name from public.subscriptions where user_id=actor;
  if not found then raise exception 'Subscription budget unavailable'; end if;
  select limits into lim from private.plan_operation_limits where plan=plan_name;
  if lim is null then raise exception 'Plan budget unavailable'; end if;
  foreach v_resource in array array['quizzes','flashcards','ocrPages','voiceSeconds'] loop
    select coalesce(sum(o.amount),0) into held from private.operation_reservations o where o.user_id=actor and o.resource=v_resource and o.created_at>=month_start and o.state in ('pending','unknown','succeeded');
    used := 0;
    if v_resource='quizzes' then select count(*) into used from public.quizzes where user_id=actor and submission_operation_id is null and created_at>=month_start;
    elsif v_resource='ocrPages' then select coalesce(sum(ocr_pages),0) into used from public.subscription_usage where user_id=actor and usage_date>=month_start::date;
    elsif v_resource='voiceSeconds' then select coalesce(sum(voice_usage_seconds),0) into used from public.subscription_usage where user_id=actor and usage_date>=month_start::date;
    end if;
    counts := counts||jsonb_build_object(v_resource,used+held);
  end loop;
  select (select count(*) from public.ai_requests where user_id=actor and operation_id is null and created_at>=month_start)
    +(select count(*) from private.operation_reservations where user_id=actor and model is not null and created_at>=month_start and state in ('pending','unknown','succeeded')) into all_ai;
  select (select count(*) from public.ai_requests where user_id=actor and operation_id is null and created_at>=day_start)
    +(select count(*) from private.operation_reservations where user_id=actor and model is not null and created_at>=day_start and state in ('pending','unknown','succeeded')) into daily_ai;
  select count(*),coalesce(sum(file_size),0) into upload_count,storage_bytes from public.uploaded_materials where user_id=actor and deleted_at is null;
  select upload_count+coalesce(sum(amount),0),storage_bytes+coalesce(sum(bytes),0) into upload_count,storage_bytes from private.operation_reservations where user_id=actor and resource='uploads' and state in ('pending','unknown');
  select count(*) into quiz_count from private.practice_receipts where user_id=actor and created_at>=month_start;
  usage := counts||jsonb_build_object('aiRequests',all_ai,'dailyAiRequests',daily_ai,'uploadsCount',upload_count,'storageBytes',storage_bytes,'quizzes',quiz_count+(counts->>'quizzes')::bigint);
  for v_resource in select jsonb_object_keys(lim) loop
    used := coalesce((usage->>case v_resource when 'dailyRequests' then 'dailyAiRequests' when 'uploads' then 'uploadsCount' when 'storage' then 'storageBytes' else v_resource end)::bigint,0);
    remaining := remaining||jsonb_build_object(case v_resource when 'uploads' then 'uploadsCount' when 'storage' then 'storageBytes' else v_resource end,greatest(0,(lim->>v_resource)::bigint-used));
  end loop;
  return jsonb_build_object('plan',plan_name,'limits',lim,'usage',usage,'remaining',remaining,'budgetSource','durable_reservations','asOf',clock_timestamp());
end $$;
revoke all on function public.get_operation_budget_snapshot() from public,anon;
grant execute on function public.get_operation_budget_snapshot() to authenticated;
