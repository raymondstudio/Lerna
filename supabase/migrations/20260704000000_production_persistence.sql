-- Migration: Production SaaS Persistence & Analytics RPCs (2026-07-04)

-- Redefine public.is_admin helper function to include config email fallback
create or replace function public.is_admin(user_id uuid)
returns boolean
security definer
language plpgsql
as $$
begin
  return exists (
    select 1 from public.admin_users au where au.user_id = $1
  ) or exists (
    select 1 from auth.users u where u.id = $1 and (
      u.email = 'msuraymond@gmail.com' or 
      u.email = 'msuraymond@gmail.com'
    )
  );
end;
$$;

-- Allow public insert to telemetry tables to bypass service-key constraints
create policy "page_views_insert_public" on public.page_views for insert to public with check (true);
create policy "analytics_events_insert_public" on public.analytics_events for insert to public with check (true);
create policy "performance_metrics_insert_public" on public.performance_metrics for insert to public with check (true);
create policy "ai_requests_insert_public" on public.ai_requests for insert to public with check (true);
create policy "feature_usage_insert_public" on public.feature_usage for insert to public with check (true);
create policy "user_attribution_insert_public" on public.user_attribution for insert to public with check (true);

-- 1. Create persistent notes table
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  content text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_user_session_unique unique (user_id, session_id)
);

-- Enable RLS on notes
alter table public.notes enable row level security;

-- RLS Policies for notes
create policy "notes_select_own" on public.notes for select to authenticated using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert to authenticated with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete to authenticated using (auth.uid() = user_id);
create policy "notes_select_admin" on public.notes for select to authenticated using (public.is_admin(auth.uid()));

grant select, insert, update, delete on table public.notes to authenticated;
grant select, insert, update, delete on table public.notes to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();

-- 2. Align Quizzes Schema
alter table public.quizzes 
  add column if not exists title text not null default 'Study Quiz',
  add column if not exists total_questions integer not null default 5,
  add column if not exists time_spent integer,
  add column if not exists difficulty text,
  add column if not exists topic text,
  add column if not exists review_mode boolean not null default false;

-- Allow nullable type for older rows, default to 'mcq'
alter table public.quizzes alter column type drop not null;
alter table public.quizzes alter column type set default 'mcq';

-- 3. Align Quiz Questions Schema
alter table public.quiz_questions 
  add column if not exists question_text text,
  add column if not exists explanation text,
  add column if not exists mastery text not null default 'learning' check (mastery in ('learning', 'familiar', 'mastered')),
  add column if not exists review_count integer not null default 0,
  add column if not exists last_reviewed_at timestamptz;

-- 4. Align Uploaded Materials Schema
alter table public.uploaded_materials 
  add column if not exists file_size integer,
  add column if not exists ocr_status text not null default 'uploaded',
  add column if not exists embedding_status text not null default 'uploaded',
  add column if not exists last_accessed_at timestamptz default now();

-- 5. Align AI Requests Schema
alter table public.ai_requests 
  add column if not exists latency_ms integer;

-- 6. Enable Realtime Publications
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'analytics_events'
  ) then
    alter publication supabase_realtime add table public.analytics_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_sessions'
  ) then
    alter publication supabase_realtime add table public.study_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'uploaded_materials'
  ) then
    alter publication supabase_realtime add table public.uploaded_materials;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quizzes'
  ) then
    alter publication supabase_realtime add table public.quizzes;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ai_requests'
  ) then
    alter publication supabase_realtime add table public.ai_requests;
  end if;
end;
$$;

-- 7. Deploy Security-Definer RPCs

-- RPC: get_admin_stats
create or replace function public.get_admin_stats()
returns json
security definer
language plpgsql
as $$
declare
  total_users integer;
  new_users_today integer;
  active_users_today integer;
  mau integer;
  total_sessions integer;
  total_messages integer;
  total_docs integer;
  total_images integer;
  ai_reqs integer;
  ai_cost numeric;
  premium_users integer;
  revenue numeric;
  
  total_tokens bigint;
  success_rate numeric;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into total_users from auth.users;
  select count(*) into new_users_today from auth.users where created_at >= now() - interval '24 hours';
  select count(*) into active_users_today from auth.users where last_sign_in_at >= now() - interval '24 hours';
  select count(*) into mau from auth.users where last_sign_in_at >= now() - interval '30 days';

  select count(*) into total_sessions from public.study_sessions;
  select count(*) into total_messages from public.study_messages;
  
  select count(*) into total_docs from public.uploaded_materials where file_type not like 'image%' and deleted_at is null;
  select count(*) into total_images from public.uploaded_materials where file_type like 'image%' and deleted_at is null;

  select count(*) into ai_reqs from public.ai_requests;
  select coalesce(sum(estimated_cost), 0.0) into ai_cost from public.ai_requests;

  select count(*) into premium_users from auth.users 
  where (raw_app_meta_data->>'role' = 'premium' or raw_app_meta_data->>'plan' = 'premium' or email = 'msuraymond@gmail.com');
  
  select (premium_users * 19.99) into revenue;

  select coalesce(sum(r.total_tokens), 0) into total_tokens from public.ai_requests r;
  select coalesce(
    (count(case when status = 'success' then 1 end) * 100.0) / nullif(count(*), 0),
    100.0
  )::numeric(5,1) into success_rate
  from public.ai_requests;

  return json_build_object(
    'total_users', total_users,
    'new_users_today', new_users_today,
    'active_users_today', active_users_today,
    'mau', mau,
    'total_sessions', total_sessions,
    'total_messages', total_messages,
    'total_docs', total_docs,
    'total_images', total_images,
    'ai_requests', ai_reqs,
    'ai_cost', ai_cost::numeric(12,4),
    'premium_users', premium_users,
    'revenue', revenue::numeric(12,2),
    'total_tokens', total_tokens,
    'success_rate', success_rate
  );
end;
$$;

-- RPC: get_admin_users
create or replace function public.get_admin_users(
  search_query text default '',
  filter_plan text default 'all',
  page_offset integer default 0,
  page_limit integer default 10
)
returns table (
  id uuid,
  name text,
  email text,
  provider text,
  joined_date timestamptz,
  last_login timestamptz,
  status text,
  total_sessions bigint,
  total_messages bigint,
  documents_uploaded bigint,
  current_plan text,
  total_count bigint
)
security definer
language plpgsql
as $$
declare
  total_users_count bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into total_users_count
  from auth.users u
  where (search_query = '' or u.email iLike '%' || search_query || '%' or coalesce(u.raw_user_meta_data->>'full_name', '') iLike '%' || search_query || '%')
    and (
      filter_plan = 'all' or
      (filter_plan = 'premium' and (u.raw_app_meta_data->>'role' = 'premium' or u.raw_app_meta_data->>'plan' = 'premium' or u.email = 'msuraymond@gmail.com')) or
      (filter_plan = 'free' and coalesce(u.raw_app_meta_data->>'role', '') != 'premium' and coalesce(u.raw_app_meta_data->>'plan', '') != 'premium' and u.email != 'msuraymond@gmail.com')
    );

  return query
  select 
    u.id,
    coalesce(u.raw_user_meta_data->>'full_name', 'User') as name,
    u.email::text,
    coalesce(u.raw_app_meta_data->>'provider', 'email')::text as provider,
    u.created_at as joined_date,
    u.last_sign_in_at as last_login,
    case when exists (select 1 from public.admin_users au where au.user_id = u.id) then 'Admin' else 'Active' end as status,
    (select count(*) from public.study_sessions s where s.user_id = u.id) as total_sessions,
    (select count(*) from public.study_messages m where m.user_id = u.id) as total_messages,
    (select count(*) from public.uploaded_materials mat where mat.user_id = u.id and mat.deleted_at is null) as documents_uploaded,
    case when (u.raw_app_meta_data->>'role' = 'premium' or u.raw_app_meta_data->>'plan' = 'premium' or u.email = 'msuraymond@gmail.com') then 'Premium'::text else 'Free'::text end as current_plan,
    total_users_count as total_count
  from auth.users u
  where (search_query = '' or u.email iLike '%' || search_query || '%' or coalesce(u.raw_user_meta_data->>'full_name', '') iLike '%' || search_query || '%')
    and (
      filter_plan = 'all' or
      (filter_plan = 'premium' and (u.raw_app_meta_data->>'role' = 'premium' or u.raw_app_meta_data->>'plan' = 'premium' or u.email = 'msuraymond@gmail.com')) or
      (filter_plan = 'free' and coalesce(u.raw_app_meta_data->>'role', '') != 'premium' and coalesce(u.raw_app_meta_data->>'plan', '') != 'premium' and u.email != 'msuraymond@gmail.com')
    )
  order by u.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- RPC: get_historical_analytics
create or replace function public.get_historical_analytics()
returns json
security definer
language plpgsql
as $$
declare
  cost_trends json;
  model_counts json;
  category_distribution json;
  university_distribution json;
  traffic_sources json;
  referral_stats json;
  top_promoters json;
  daily_users json;
  daily_study_hours json;
  daily_quizzes json;
  daily_uploads json;
  daily_tokens json;
  
  avg_duration_minutes numeric;
  quiz_accuracy numeric;
  total_quiz_questions bigint;
  correct_answers bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  -- 1. Cost trends last 7 days
  select json_agg(t) into cost_trends from (
    select to_char(d, 'Mon DD') as date,
           coalesce(sum(r.estimated_cost), 0.0)::numeric(12,4) as cost
    from generate_series(now() - interval '6 days', now(), interval '1 day') d
    left join public.ai_requests r on date_trunc('day', r.created_at) = date_trunc('day', d)
    group by d
    order by d asc
  ) t;

  -- 2. Model counts
  select json_object_agg(model_used, count) into model_counts from (
    select coalesce(model_used, 'gemini-2.5-flash') as model_used, count(*) as count
    from public.ai_requests
    group by model_used
  ) t;

  -- 3. Category distribution
  select json_object_agg(topic_category, count) into category_distribution from (
    select coalesce(topic_category, 'General') as topic_category, count(*) as count
    from public.study_sessions
    group by topic_category
  ) t;

  -- 4. University distribution (.edu domains etc)
  select json_object_agg(domain, count) into university_distribution from (
    select split_part(u.email, '@', 2) as domain, count(*) as count
    from auth.users u
    where split_part(u.email, '@', 2) like '%.edu' or split_part(u.email, '@', 2) like '%.ac.%' or split_part(u.email, '@', 2) like '%.org'
    group by domain
    order by count desc
    limit 5    
  ) t;

  -- 5. Traffic sources UTM attribution
  select json_object_agg(source, count) into traffic_sources from (
    select coalesce(utm_source, 'direct') as source, count(*) as count
    from public.user_attribution
    group by utm_source
  ) t;

  -- 6. Referral performance stats
  select json_build_object(
    'totalInvited', (select count(*) from public.referrals),
    'activeCodes', (select count(*) from public.referral_codes),
    'conversionRate', coalesce((select (count(case when status='completed' or status='rewarded' then 1 end)*100.0)/nullif(count(*), 0) from public.referrals), 0.0)::numeric(5,1),
    'rewardsIssued', (select count(*) from public.referral_rewards)
  ) into referral_stats;

  -- 7. Top promoters
  select json_agg(t) into top_promoters from (
    select 
      coalesce(u.raw_user_meta_data->>'full_name', 'Student') as name,
      u.email::text,
      (select count(*) from public.referrals r where r.referrer_id = u.id) as referrals,
      'Active'::text as rewardStatus
    from auth.users u
    where exists (select 1 from public.referrals r where r.referrer_id = u.id)
    order by referrals desc
    limit 5
  ) t;

  -- 8. Daily users trends last 30 days
  select json_agg(t) into daily_users from (
    select to_char(d, 'YYYY-MM-DD') as date,
           count(distinct r.user_id) as count
    from generate_series(now() - interval '29 days', now(), interval '1 day') d
    left join public.page_views r on date_trunc('day', r.created_at) = date_trunc('day', d)
    group by d
    order by d asc
  ) t;

  -- 9. Daily study hours last 30 days
  select json_agg(t) into daily_study_hours from (
    select to_char(d, 'YYYY-MM-DD') as date,
           coalesce(sum(s.duration_seconds)/3600.0, 0.0)::numeric(10,2) as hours
    from generate_series(now() - interval '29 days', now(), interval '1 day') d
    left join public.study_sessions s on date_trunc('day', s.created_at) = date_trunc('day', d)
    group by d
    order by d asc
  ) t;

  -- 10. Daily quizzes completed last 30 days
  select json_agg(t) into daily_quizzes from (
    select to_char(d, 'YYYY-MM-DD') as date,
           count(q.id) as count
    from generate_series(now() - interval '29 days', now(), interval '1 day') d
    left join public.quizzes q on date_trunc('day', q.created_at) = date_trunc('day', d)
    group by d
    order by d asc
  ) t;

  -- 11. Daily uploads last 30 days
  select json_agg(t) into daily_uploads from (
    select to_char(d, 'YYYY-MM-DD') as date,
           count(u.id) as count
    from generate_series(now() - interval '29 days', now(), interval '1 day') d
    left join public.uploaded_materials u on date_trunc('day', u.created_at) = date_trunc('day', d) and u.deleted_at is null
    group by d
    order by d asc
  ) t;

  -- 12. Daily token usage trends
  select json_agg(t) into daily_tokens from (
    select to_char(d, 'YYYY-MM-DD') as date,
           coalesce(sum(r.total_tokens), 0)::bigint as tokens
    from generate_series(now() - interval '29 days', now(), interval '1 day') d
    left join public.ai_requests r on date_trunc('day', r.created_at) = date_trunc('day', d)
    group by d
    order by d asc
  ) t;

  -- 13. Average session duration in minutes
  select coalesce(avg(duration_seconds)/60.0, 0.0)::numeric(10,1) into avg_duration_minutes
  from public.study_sessions;

  -- 14. Quiz accuracy
  select coalesce(avg(score), 0.0)::numeric(5,1) into quiz_accuracy
  from public.quizzes;

  -- 15. Quiz questions and correct answers counts
  select count(*) into total_quiz_questions
  from public.quiz_questions;

  select count(*) into correct_answers
  from public.quiz_questions
  where is_correct = true;

  return json_build_object(
    'costTrends', cost_trends,
    'modelCounts', model_counts,
    'categoryDistribution', category_distribution,
    'universityDistribution', university_distribution,
    'trafficSources', traffic_sources,
    'referralStats', referral_stats,
    'topPromoters', top_promoters,
    'dailyUsers', daily_users,
    'dailyStudyHours', daily_study_hours,
    'dailyQuizzes', daily_quizzes,
    'dailyUploads', daily_uploads,
    'dailyTokens', daily_tokens,
    'avgDurationMinutes', avg_duration_minutes,
    'quizAccuracy', quiz_accuracy,
    'totalQuizQuestions', total_quiz_questions,
    'correctAnswers', correct_answers
  );
end;
$$;

-- RPC: get_admin_user_details
create or replace function public.get_admin_user_details(target_user_id uuid)
returns json
security definer
language plpgsql
as $$
declare
  user_email text;
  user_name text;
  user_provider text;
  user_joined timestamptz;
  user_last_login timestamptz;
  user_status text;
  user_device text := 'Desktop';
  user_plan text := 'Free';
  user_sessions json;
  user_uploads json;
  user_ai_requests json;
  user_attribution json;
  total_prompt bigint := 0;
  total_completion bigint := 0;
  total_cost numeric(12,6) := 0.0;
  total_quizzes_count bigint := 0;
  total_notes_count bigint := 0;
  storage_usage_bytes bigint := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  -- 1. Fetch user auth profile
  select 
    email::text, 
    coalesce(raw_user_meta_data->>'full_name', 'User'),
    coalesce(raw_app_meta_data->>'provider', 'email')::text,
    created_at,
    last_sign_in_at,
    case when exists (select 1 from public.admin_users au where au.user_id = target_user_id) then 'Admin' else 'Active' end,
    case when (raw_app_meta_data->>'role' = 'premium' or raw_app_meta_data->>'plan' = 'premium') then 'Premium' else 'Free' end
  into user_email, user_name, user_provider, user_joined, user_last_login, user_status, user_plan
  from auth.users
  where id = target_user_id;

  if user_email is null then
    return null;
  end if;

  -- 2. Fetch Sessions
  select coalesce(json_agg(t), '[]'::json) into user_sessions from (
    select id, title, topic_category, status, created_at, updated_at
    from public.study_sessions
    where user_id = target_user_id
    order by updated_at desc
  ) t;

  -- 3. Fetch Uploads
  select coalesce(json_agg(t), '[]'::json) into user_uploads from (
    select id, file_name, file_type, created_at, coalesce(file_size, 0) as file_size, status
    from public.uploaded_materials
    where user_id = target_user_id and deleted_at is null
    order by created_at desc
  ) t;

  -- Sum storage usage
  select coalesce(sum(file_size), 0) into storage_usage_bytes
  from public.uploaded_materials
  where user_id = target_user_id and deleted_at is null;

  -- 4. Fetch AI usage stats
  select coalesce(json_agg(t), '[]'::json) into user_ai_requests from (
    select id, model_used, request_type, prompt_tokens, completion_tokens, estimated_cost, status, created_at
    from public.ai_requests
    where user_id = target_user_id
    order by created_at desc
  ) t;

  -- Sum tokens and cost
  select 
    coalesce(sum(prompt_tokens), 0),
    coalesce(sum(completion_tokens), 0),
    coalesce(sum(estimated_cost), 0.0)
  into total_prompt, total_completion, total_cost
  from public.ai_requests
  where user_id = target_user_id;

  -- 5. Fetch User Attribution
  select row_to_json(t) into user_attribution from (
    select utm_source, utm_medium, utm_campaign, referrer, created_at
    from public.user_attribution
    where user_id = target_user_id
  ) t;

  -- 6. Detect device from last page view
  select 
    case when user_agent iLike '%mobi%' or user_agent iLike '%android%' or user_agent iLike '%iphone%' then 'Mobile' else 'Desktop' end
  into user_device
  from public.page_views
  where user_id = target_user_id
  order by created_at desc
  limit 1;

  if user_device is null then
    user_device := 'Desktop';
  end if;

  -- 7. Count quizzes and notes
  select count(*) into total_quizzes_count from public.quizzes where user_id = target_user_id;
  select count(*) into total_notes_count from public.notes where user_id = target_user_id;

  return json_build_object(
    'profile', json_build_object(
      'id', target_user_id,
      'name', user_name,
      'email', user_email,
      'provider', user_provider,
      'joinedDate', user_joined,
      'lastLogin', coalesce(user_last_login, user_joined),
      'status', user_status,
      'device', user_device,
      'subscriptionStatus', user_plan,
      'storageUsageBytes', storage_usage_bytes,
      'totalQuizzes', total_quizzes_count,
      'totalNotes', total_notes_count
    ),
    'attribution', user_attribution,
    'sessions', user_sessions,
    'uploads', user_uploads,
    'aiUsage', json_build_object(
      'requests', user_ai_requests,
      'totalRequestsCount', coalesce((select count(*) from public.ai_requests where user_id = target_user_id), 0),
      'totalPromptTokens', total_prompt,
      'totalCompletionTokens', total_completion,
      'totalCost', total_cost::numeric(12,6)
    )
  );
end;
$$;
