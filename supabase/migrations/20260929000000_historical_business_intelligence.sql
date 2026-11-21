-- Historical business intelligence foundation.
-- Operational tables remain authoritative; this migration does not fabricate or
-- duplicate past activity into analytics events.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Remove earlier permissive telemetry policies. All ingestion now goes through
-- authenticated server routes using the service role; RLS still protects reads.
drop policy if exists "page_views_insert_public" on public.page_views;
drop policy if exists "analytics_events_insert_public" on public.analytics_events;
drop policy if exists "performance_metrics_insert_public" on public.performance_metrics;
drop policy if exists "ai_requests_insert_public" on public.ai_requests;
drop policy if exists "feature_usage_insert_public" on public.feature_usage;
drop policy if exists "user_attribution_insert_public" on public.user_attribution;

create index if not exists study_messages_created_user_role_idx
  on public.study_messages (created_at, user_id, role);
create index if not exists study_sessions_created_user_idx
  on public.study_sessions (created_at, user_id);
create index if not exists uploaded_materials_created_user_idx
  on public.uploaded_materials (created_at, user_id);
create index if not exists quizzes_created_user_type_idx
  on public.quizzes (created_at, user_id, type);
create index if not exists ai_requests_created_status_user_idx
  on public.ai_requests (created_at, status, user_id);
create index if not exists events_created_user_type_idx
  on public.events (created_at, user_id, event_type);
create index if not exists page_views_created_user_idx
  on public.page_views (created_at, user_id);
create index if not exists feature_usage_created_feature_user_idx
  on public.feature_usage (created_at, feature_name, user_id);
create index if not exists user_attribution_created_source_idx
  on public.user_attribution (created_at, utm_source);
create index if not exists referrals_created_status_idx
  on public.referrals (created_at, status);
create index if not exists subscriptions_created_plan_status_idx
  on public.subscriptions (created_at, plan, status);
create index if not exists subscription_history_created_plan_idx
  on public.subscription_history (created_at, new_plan);
create index if not exists billing_transactions_created_status_currency_idx
  on public.billing_transactions (created_at, status, currency);
create index if not exists profiles_created_at_idx
  on public.profiles (created_at);

alter table public.ai_requests
  add column if not exists input_rate_per_million numeric(12,6),
  add column if not exists output_rate_per_million numeric(12,6),
  add column if not exists pricing_currency text not null default 'USD',
  add column if not exists pricing_version text;

-- Safe derived backfill: recompute known Gemini 2.5 Flash estimates from the
-- already-recorded token counts and the documented standard paid-tier rate.
update public.ai_requests
set estimated_cost = round((prompt_tokens * 0.30 + completion_tokens * 2.50) / 1000000.0, 6),
    input_rate_per_million = 0.30,
    output_rate_per_million = 2.50,
    pricing_currency = 'USD',
    pricing_version = 'google-standard-2026-09-backfill'
where lower(model_used) like '%gemini-2.5-flash%'
  and lower(model_used) not like '%flash-lite%';

update public.ai_requests
set estimated_cost = round((prompt_tokens * 0.10 + completion_tokens * 0.40) / 1000000.0, 6),
    input_rate_per_million = 0.10,
    output_rate_per_million = 0.40,
    pricing_currency = 'USD',
    pricing_version = 'google-standard-2026-09-backfill'
where lower(model_used) like '%gemini-2.5-flash-lite%';

-- Telemetry timestamps are assigned by Postgres, not accepted from a browser.
create or replace function private.force_server_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'events', 'analytics_events', 'page_views', 'feature_usage',
    'performance_metrics', 'ai_requests'
  ] loop
    execute format('drop trigger if exists force_server_created_at on public.%I', table_name);
    execute format(
      'create trigger force_server_created_at before insert on public.%I for each row execute function private.force_server_created_at()',
      table_name
    );
  end loop;
end;
$$;

-- Keep the event ledger append-only for application/admin roles. Service role and
-- database owner access remain available for retention and incident response.
drop policy if exists "events_admin_all" on public.events;
drop policy if exists "events_admin_select" on public.events;
create policy "events_admin_select" on public.events
  for select to authenticated
  using (public.is_admin((select auth.uid())));
revoke update, delete on public.events from authenticated;

create or replace function private.admin_metric_snapshot(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_timezone text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with activity as (
    select pv.user_id, pv.created_at from public.page_views pv
      where pv.user_id is not null and pv.created_at >= p_start_at and pv.created_at < p_end_at
    union all
    select e.user_id, e.created_at from public.events e
      where e.user_id is not null and e.created_at >= p_start_at and e.created_at < p_end_at
    union all
    select m.user_id, m.created_at from public.study_messages m
      where m.role = 'user' and m.created_at >= p_start_at and m.created_at < p_end_at
    union all
    select s.user_id, s.created_at from public.study_sessions s
      where s.created_at >= p_start_at and s.created_at < p_end_at
    union all
    select u.user_id, u.created_at from public.uploaded_materials u
      where u.created_at >= p_start_at and u.created_at < p_end_at
    union all
    select q.user_id, q.created_at from public.quizzes q
      where q.created_at >= p_start_at and q.created_at < p_end_at
    union all
    select a.user_id, a.created_at from public.ai_requests a
      where a.user_id is not null and a.created_at >= p_start_at and a.created_at < p_end_at
  ),
  active as (
    select distinct a.user_id from activity a
  ),
  daily_active as (
    select date_trunc('day', a.created_at at time zone p_timezone) as bucket, count(distinct a.user_id)::numeric as users
    from activity a group by 1
  ),
  weekly_active as (
    select date_trunc('week', a.created_at at time zone p_timezone) as bucket, count(distinct a.user_id)::numeric as users
    from activity a group by 1
  ),
  monthly_active as (
    select date_trunc('month', a.created_at at time zone p_timezone) as bucket, count(distinct a.user_id)::numeric as users
    from activity a group by 1
  ),
  user_counts as (
    select count(*)::bigint as new_users from auth.users u
    where u.created_at >= p_start_at and u.created_at < p_end_at
  ),
  message_counts as (
    select
      count(*)::bigint as total_messages,
      count(*) filter (where m.role = 'user')::bigint as user_messages,
      count(*) filter (where m.role = 'assistant')::bigint as assistant_messages,
      count(distinct m.user_id) filter (where m.role = 'user')::bigint as unique_chat_users
    from public.study_messages m
    where m.created_at >= p_start_at and m.created_at < p_end_at
  ),
  session_counts as (
    select
      count(*)::bigint as study_sessions,
      count(*) filter (where s.status = 'completed')::bigint as completed_sessions,
      coalesce(sum(s.duration_seconds), 0)::bigint as study_time_seconds
    from public.study_sessions s
    where s.created_at >= p_start_at and s.created_at < p_end_at
  ),
  upload_counts as (
    select count(*)::bigint as uploads
    from public.uploaded_materials u
    where u.created_at >= p_start_at and u.created_at < p_end_at
  ),
  quiz_counts as (
    select
      count(*)::bigint as quiz_attempts,
      count(*) filter (where q.score is not null)::bigint as quiz_completions,
      round(avg(q.score) filter (where q.score is not null), 2) as average_quiz_score,
      count(*) filter (where q.type = 'flashcard')::bigint as flashcard_generations
    from public.quizzes q
    where q.created_at >= p_start_at and q.created_at < p_end_at
  ),
  ai_counts as (
    select
      count(*)::bigint as ai_requests,
      count(*) filter (where lower(a.status) not in ('success', 'completed'))::bigint as ai_failures,
      coalesce(sum(a.total_tokens), 0)::bigint as ai_tokens,
      coalesce(sum(a.estimated_cost), 0)::numeric(16,6) as ai_estimated_cost,
      round(avg(a.latency_ms) filter (where a.latency_ms is not null), 2) as average_latency_ms,
      round((percentile_cont(0.95) within group (order by a.latency_ms)
        filter (where a.latency_ms is not null))::numeric, 2) as p95_latency_ms
    from public.ai_requests a
    where a.created_at >= p_start_at and a.created_at < p_end_at
  ),
  referral_counts as (
    select
      count(*)::bigint as referrals,
      count(*) filter (where r.status in ('completed', 'rewarded'))::bigint as referral_conversions
    from public.referrals r
    where r.created_at >= p_start_at and r.created_at < p_end_at
  ),
  subscription_counts as (
    select
      count(*)::bigint as subscriptions_started,
      count(*) filter (where s.plan not in ('free'))::bigint as premium_subscriptions_started
    from public.subscriptions s
    where s.created_at >= p_start_at and s.created_at < p_end_at
  ),
  payment_counts as (
    select
      count(*) filter (where b.status = 'successful')::bigint as successful_payments,
      case when count(distinct b.currency) filter (where b.status = 'successful') <= 1
        then coalesce(sum(b.amount) filter (where b.status = 'successful'), 0)
        else null end as revenue_single_currency
    from public.billing_transactions b
    where b.created_at >= p_start_at and b.created_at < p_end_at
  )
  select jsonb_build_object(
    'new_users', uc.new_users,
    'active_users', (select count(*)::bigint from active),
    'returning_users', (
      select count(*)::bigint from active a join auth.users u on u.id = a.user_id where u.created_at < p_start_at
    ),
    'dau', coalesce((select round(avg(users), 2) from daily_active), 0),
    'wau', coalesce((select round(avg(users), 2) from weekly_active), 0),
    'mau', coalesce((select round(avg(users), 2) from monthly_active), 0),
    'total_messages', mc.total_messages,
    'user_messages', mc.user_messages,
    'assistant_messages', mc.assistant_messages,
    'unique_chat_users', mc.unique_chat_users,
    'messages_per_chat_user', round(mc.total_messages::numeric / nullif(mc.unique_chat_users, 0), 2),
    'study_sessions', sc.study_sessions,
    'completed_study_sessions', sc.completed_sessions,
    'study_time_seconds', sc.study_time_seconds,
    'uploads', up.uploads,
    'quiz_attempts', qc.quiz_attempts,
    'quiz_completions', qc.quiz_completions,
    'quiz_completion_rate', round(qc.quiz_completions::numeric * 100 / nullif(qc.quiz_attempts, 0), 2),
    'average_quiz_score', qc.average_quiz_score,
    'total_quiz_questions', (
      select count(*)::bigint from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where q.created_at >= p_start_at and q.created_at < p_end_at
    ),
    'correct_quiz_answers', (
      select count(*)::bigint from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where q.created_at >= p_start_at and q.created_at < p_end_at and qq.is_correct is true
    ),
    'flashcard_generations', qc.flashcard_generations,
    'ai_requests', ac.ai_requests,
    'ai_failures', ac.ai_failures,
    'ai_success_rate', round((ac.ai_requests - ac.ai_failures)::numeric * 100 / nullif(ac.ai_requests, 0), 2),
    'ai_tokens', ac.ai_tokens,
    'ai_estimated_cost', ac.ai_estimated_cost,
    'average_latency_ms', ac.average_latency_ms,
    'p95_latency_ms', ac.p95_latency_ms,
    'feature_usage_events', (
      select count(*)::bigint from public.feature_usage f where f.created_at >= p_start_at and f.created_at < p_end_at
    ),
    'referrals', rc.referrals,
    'referral_conversions', rc.referral_conversions,
    'referral_conversion_rate', round(rc.referral_conversions::numeric * 100 / nullif(rc.referrals, 0), 2),
    'subscriptions_started', sub.subscriptions_started,
    'premium_subscriptions_started', sub.premium_subscriptions_started,
    'premium_conversion_rate', round(sub.premium_subscriptions_started::numeric * 100 / nullif(uc.new_users, 0), 2),
    'successful_payments', pc.successful_payments,
    'revenue', pc.revenue_single_currency,
    'mrr', null,
    'churn_rate', null,
    'retention_rate', null
  )
  from user_counts uc
  cross join message_counts mc
  cross join session_counts sc
  cross join upload_counts up
  cross join quiz_counts qc
  cross join ai_counts ac
  cross join referral_counts rc
  cross join subscription_counts sub
  cross join payment_counts pc;
$$;

create or replace function public.get_admin_business_intelligence(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_timezone text default 'UTC',
  p_bucket text default 'day',
  p_compare boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_metrics jsonb;
  previous_metrics jsonb;
  series_data jsonb;
  range_duration interval;
  previous_start timestamptz;
  bucket_interval interval;
  bucket_count numeric;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
    raise exception 'Invalid analytics range';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone';
  end if;
  if p_bucket not in ('hour', 'day', 'week', 'month') then
    raise exception 'Invalid bucket';
  end if;

  range_duration := p_end_at - p_start_at;
  previous_start := p_start_at - range_duration;
  bucket_interval := case p_bucket
    when 'hour' then interval '1 hour'
    when 'day' then interval '1 day'
    when 'week' then interval '1 week'
    else interval '1 month'
  end;
  bucket_count := extract(epoch from range_duration) /
    greatest(extract(epoch from bucket_interval), 1);
  if bucket_count > 5000 then
    raise exception 'Analytics range creates too many buckets';
  end if;

  current_metrics := private.admin_metric_snapshot(p_start_at, p_end_at, p_timezone);
  if p_compare then
    previous_metrics := private.admin_metric_snapshot(previous_start, p_start_at, p_timezone);
  end if;

  with local_buckets as (
    select gs as local_start
    from pg_catalog.generate_series(
      date_trunc(p_bucket, p_start_at at time zone p_timezone),
      date_trunc(p_bucket, (p_end_at - interval '1 microsecond') at time zone p_timezone),
      bucket_interval
    ) gs
  ),
  buckets as (
    select
      greatest(local_start at time zone p_timezone, p_start_at) as bucket_start,
      least((local_start + bucket_interval) at time zone p_timezone, p_end_at) as bucket_end
    from local_buckets
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'start_at', b.bucket_start,
    'end_at', b.bucket_end,
    'new_users', (select count(*) from auth.users u where u.created_at >= b.bucket_start and u.created_at < b.bucket_end),
    'active_users', (
      select count(distinct x.user_id) from (
        select user_id from public.page_views where user_id is not null and created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.events where user_id is not null and created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.study_messages where role = 'user' and created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.study_sessions where created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.uploaded_materials where created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.quizzes where created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.ai_requests where user_id is not null and created_at >= b.bucket_start and created_at < b.bucket_end
      ) x
    ),
    'messages', (select count(*) from public.study_messages m where m.created_at >= b.bucket_start and m.created_at < b.bucket_end),
    'unique_chat_users', (select count(distinct m.user_id) from public.study_messages m where m.role = 'user' and m.created_at >= b.bucket_start and m.created_at < b.bucket_end),
    'study_sessions', (select count(*) from public.study_sessions s where s.created_at >= b.bucket_start and s.created_at < b.bucket_end),
    'uploads', (select count(*) from public.uploaded_materials u where u.created_at >= b.bucket_start and u.created_at < b.bucket_end),
    'quiz_attempts', (select count(*) from public.quizzes q where q.created_at >= b.bucket_start and q.created_at < b.bucket_end),
    'ai_requests', (select count(*) from public.ai_requests a where a.created_at >= b.bucket_start and a.created_at < b.bucket_end),
    'ai_cost', (select coalesce(sum(a.estimated_cost), 0) from public.ai_requests a where a.created_at >= b.bucket_start and a.created_at < b.bucket_end)
  ) order by b.bucket_start), '[]'::jsonb)
  into series_data
  from buckets b;

  return jsonb_build_object(
    'range', jsonb_build_object(
      'start_at', p_start_at,
      'end_at', p_end_at,
      'timezone', p_timezone,
      'bucket', p_bucket,
      'end_exclusive', true
    ),
    'metrics', current_metrics,
    'comparison', case when p_compare then jsonb_build_object(
      'start_at', previous_start,
      'end_at', p_start_at,
      'metrics', previous_metrics
    ) else null end,
    'series', series_data,
    'breakdowns', jsonb_build_object(
      'traffic_sources', coalesce((
        select jsonb_agg(jsonb_build_object('source', source, 'users', users) order by users desc)
        from (
          select coalesce(nullif(a.utm_source, ''), 'direct') as source, count(*)::bigint as users
          from public.user_attribution a
          where a.created_at >= p_start_at and a.created_at < p_end_at
          group by 1
        ) x
      ), '[]'::jsonb),
      'ai_models', coalesce((
        select jsonb_agg(jsonb_build_object('model', model_used, 'requests', requests) order by requests desc)
        from (
          select a.model_used, count(*)::bigint as requests
          from public.ai_requests a
          where a.created_at >= p_start_at and a.created_at < p_end_at
          group by a.model_used
        ) x
      ), '[]'::jsonb),
      'feature_usage', coalesce((
        select jsonb_agg(jsonb_build_object('feature', feature_name, 'uses', uses, 'users', users) order by uses desc)
        from (
          select f.feature_name, count(*)::bigint as uses, count(distinct f.user_id)::bigint as users
          from public.feature_usage f
          where f.created_at >= p_start_at and f.created_at < p_end_at
          group by f.feature_name
        ) x
      ), '[]'::jsonb),
      'study_categories', coalesce((
        select jsonb_agg(jsonb_build_object('category', category, 'sessions', sessions) order by sessions desc)
        from (
          select coalesce(nullif(s.topic_category, ''), 'General') as category, count(*)::bigint as sessions
          from public.study_sessions s
          where s.created_at >= p_start_at and s.created_at < p_end_at
          group by 1
        ) x
      ), '[]'::jsonb),
      'revenue_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount, 'payments', payments) order by currency)
        from (
          select b.currency, sum(b.amount) as amount, count(*)::bigint as payments
          from public.billing_transactions b
          where b.status = 'successful' and b.created_at >= p_start_at and b.created_at < p_end_at
          group by b.currency
        ) x
      ), '[]'::jsonb)
    ),
    'coverage', jsonb_build_object(
      'users', (select min(created_at) from auth.users),
      'messages', (select min(created_at) from public.study_messages),
      'study_sessions', (select min(created_at) from public.study_sessions),
      'uploads', (select min(created_at) from public.uploaded_materials),
      'quizzes', (select min(created_at) from public.quizzes),
      'ai_usage', (select min(created_at) from public.ai_requests),
      'feature_usage', (select min(created_at) from public.feature_usage),
      'traffic_sources', (select min(created_at) from public.user_attribution),
      'referrals', (select min(created_at) from public.referrals),
      'subscriptions', (select min(created_at) from public.subscriptions),
      'revenue', (select min(created_at) from public.billing_transactions)
    ),
    'limitations', jsonb_build_array(
      'MRR is not calculated because no authoritative price-per-plan or normalized recurring revenue ledger exists.',
      'Churn and historical subscription state are unavailable because status transitions were not historically recorded with effective timestamps.',
      'Retention is not emitted until a cohort definition and sufficient activity history are available.',
      'Referral conversion uses current status and referral created_at because no conversion timestamp exists.',
      'Flashcard generation is derived from quizzes.type = flashcard because no separate flashcards table exists.'
    )
  );
end;
$$;

revoke all on function public.get_admin_business_intelligence(timestamptz, timestamptz, text, text, boolean) from public, anon;
grant execute on function public.get_admin_business_intelligence(timestamptz, timestamptz, text, text, boolean) to authenticated;

-- Repair the existing optional daily cache to use columns/tables that actually exist.
create or replace function public.recalculate_daily_stats(target_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin((select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  insert into public.daily_stats (
    date, new_users, active_users, documents_uploaded, study_sessions, messages,
    quizzes, flashcards, hours_studied, tokens_used, storage_used, updated_at
  )
  select
    target_date,
    (select count(*) from auth.users u where u.created_at >= target_date::timestamp and u.created_at < target_date::timestamp + interval '1 day'),
    (select count(distinct x.user_id) from (
      select user_id from public.study_messages where role = 'user' and created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'
      union all select user_id from public.page_views where user_id is not null and created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'
      union all select user_id from public.study_sessions where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'
    ) x),
    (select count(*) from public.uploaded_materials where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select count(*) from public.study_sessions where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select count(*) from public.study_messages where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select count(*) from public.quizzes where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select count(*) from public.quizzes where type = 'flashcard' and created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select coalesce(sum(duration_seconds), 0) / 3600.0 from public.study_sessions where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select coalesce(sum(total_tokens), 0) from public.ai_requests where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    (select coalesce(sum(file_size), 0) from public.uploaded_materials where created_at >= target_date::timestamp and created_at < target_date::timestamp + interval '1 day'),
    clock_timestamp()
  on conflict (date) do update set
    new_users = excluded.new_users,
    active_users = excluded.active_users,
    documents_uploaded = excluded.documents_uploaded,
    study_sessions = excluded.study_sessions,
    messages = excluded.messages,
    quizzes = excluded.quizzes,
    flashcards = excluded.flashcards,
    hours_studied = excluded.hours_studied,
    tokens_used = excluded.tokens_used,
    storage_used = excluded.storage_used,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.recalculate_daily_stats(date) from public, anon;
grant execute on function public.recalculate_daily_stats(date) to authenticated, service_role;

-- Preserve the existing dashboard's live behavior. Postgres Changes is retained
-- for this low-volume admin-only surface; Supabase Broadcast should replace it if
-- fan-out or event volume grows materially.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['events', 'study_messages', 'profiles', 'billing_transactions'] loop
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

comment on function public.get_admin_business_intelligence(timestamptz, timestamptz, text, text, boolean)
  is 'Canonical admin BI query. Uses half-open UTC ranges [start_at,end_at), timezone-local buckets, operational sources, and an equivalent preceding comparison period.';
