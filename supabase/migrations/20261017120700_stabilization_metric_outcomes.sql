-- Preserve the existing BI envelope while excluding administrative auditing,
-- pending/unknown/simulated outcomes from success denominators and fabricated costs.
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
    select e.user_id, e.created_at from public.events e
      where e.user_id is not null and e.schema_version=1 and e.category in ('navigation','study','material','ai') and e.outcome in ('reported','succeeded') and e.created_at >= p_start_at and e.created_at < p_end_at
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
      where a.user_id is not null and a.authoritative_outcome in ('succeeded','legacy_unverified') and a.created_at >= p_start_at and a.created_at < p_end_at
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
      count(*) filter(where a.authoritative_outcome in ('succeeded','failed') or (a.authoritative_outcome='legacy_unverified' and lower(a.status) in ('success','completed','failed','error')))::bigint as ai_requests,
      count(*) filter (where a.authoritative_outcome='failed' or (a.authoritative_outcome='legacy_unverified' and lower(a.status) in ('failed','error')))::bigint as ai_failures,
      count(*) filter(where a.authoritative_outcome='unknown')::bigint as ai_unknown,
      count(*) filter(where a.authoritative_outcome='simulated')::bigint as ai_simulated,
      count(*) filter(where a.authoritative_outcome<>'simulated' and a.estimated_cost is null)::bigint as ai_cost_unavailable,
      coalesce(sum(a.total_tokens) filter(where a.authoritative_outcome in ('succeeded','failed','legacy_unverified')), 0)::bigint as ai_tokens,
      case when count(*) filter(where a.authoritative_outcome<>'simulated' and a.estimated_cost is null)>0 then null else coalesce(sum(a.estimated_cost) filter(where a.authoritative_outcome<>'simulated'),0) end::numeric(16,6) as ai_estimated_cost,
      round(avg(a.latency_ms) filter (where a.latency_ms is not null and a.authoritative_outcome<>'simulated'), 2) as average_latency_ms,
      round((percentile_cont(0.95) within group (order by a.latency_ms)
        filter (where a.latency_ms is not null and a.authoritative_outcome<>'simulated'))::numeric, 2) as p95_latency_ms
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
    'ai_unknown', ac.ai_unknown,
    'ai_simulated', ac.ai_simulated,
    'ai_cost_unavailable', ac.ai_cost_unavailable,
    'ai_pending', (select count(*) from private.operation_reservations o where o.model is not null and o.state='pending' and o.created_at>=p_start_at and o.created_at<p_end_at),
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
        select user_id from public.events where user_id is not null and schema_version=1 and category in ('navigation','study','material','ai') and outcome in ('reported','succeeded') and created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.study_messages where role = 'user' and created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.study_sessions where created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.uploaded_materials where created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.quizzes where created_at >= b.bucket_start and created_at < b.bucket_end
        union all select user_id from public.ai_requests where user_id is not null and authoritative_outcome in ('succeeded','legacy_unverified') and created_at >= b.bucket_start and created_at < b.bucket_end
      ) x
    ),
    'messages', (select count(*) from public.study_messages m where m.created_at >= b.bucket_start and m.created_at < b.bucket_end),
    'unique_chat_users', (select count(distinct m.user_id) from public.study_messages m where m.role = 'user' and m.created_at >= b.bucket_start and m.created_at < b.bucket_end),
    'study_sessions', (select count(*) from public.study_sessions s where s.created_at >= b.bucket_start and s.created_at < b.bucket_end),
    'uploads', (select count(*) from public.uploaded_materials u where u.created_at >= b.bucket_start and u.created_at < b.bucket_end),
    'quiz_attempts', (select count(*) from public.quizzes q where q.created_at >= b.bucket_start and q.created_at < b.bucket_end),
    'ai_requests', (select count(*) from public.ai_requests a where a.authoritative_outcome in ('succeeded','failed','legacy_unverified') and a.created_at >= b.bucket_start and a.created_at < b.bucket_end),
    'ai_cost', (select case when count(*) filter(where a.estimated_cost is null)>0 then null else coalesce(sum(a.estimated_cost),0) end from public.ai_requests a where a.authoritative_outcome<>'simulated' and a.created_at >= b.bucket_start and a.created_at < b.bucket_end)
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
          where a.authoritative_outcome in ('succeeded','failed','legacy_unverified') and a.created_at >= p_start_at and a.created_at < p_end_at
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
