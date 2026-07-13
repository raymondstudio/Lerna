-- Migration: Admin Dashboard and Analytics Tables

-- 1. Create admin_users table
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Enable RLS on admin_users
alter table public.admin_users enable row level security;

-- Policies for admin_users
-- Admins can view/edit admin_users. Regular authenticated users cannot.
create policy "admin_users_select_admin" on public.admin_users
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    ) or (
      select email from auth.users where id = auth.uid()
    ) = 'msuraymond@gmail.com'
  );

create policy "admin_users_insert_admin" on public.admin_users
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    ) or (
      select email from auth.users where id = auth.uid()
    ) = 'msuraymond@gmail.com'
  );

create policy "admin_users_delete_admin" on public.admin_users
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    ) or (
      select email from auth.users where id = auth.uid()
    ) = 'msuraymond@gmail.com'
  );

grant select, insert, delete on table public.admin_users to authenticated;
grant select, insert, delete on table public.admin_users to service_role;

-- 2. Create is_admin helper function
create or replace function public.is_admin(user_id uuid)
returns boolean
security definer
language plpgsql
as $$
begin
  return exists (
    select 1 from public.admin_users au where au.user_id = $1
  ) or exists (
    select 1 from auth.users u where u.id = $1 and u.email = 'msuraymond@gmail.com'
  );
end;
$$;

-- 3. Create analytics tables
-- Table: public.user_attribution (stored once per user)
create table if not exists public.user_attribution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamptz not null default now()
);

-- Table: public.ai_requests
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0.000000,
  model_used text not null,
  request_type text not null,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

-- Table: public.analytics_events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Table: public.feature_usage
create table if not exists public.feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  feature_name text not null,
  additional_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Table: public.page_views
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  path text not null,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Table: public.performance_metrics
create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  metric_name text not null,
  metric_value numeric not null,
  additional_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS on all analytics tables
alter table public.user_attribution enable row level security;
alter table public.ai_requests enable row level security;
alter table public.analytics_events enable row level security;
alter table public.feature_usage enable row level security;
alter table public.page_views enable row level security;
alter table public.performance_metrics enable row level security;

-- RLS Policies for analytics tables:
-- 1. user_attribution
create policy "user_attribution_insert_own" on public.user_attribution for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_attribution_select_own" on public.user_attribution for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_attribution_select_admin" on public.user_attribution for select to authenticated using (public.is_admin((select auth.uid())));

-- 2. ai_requests
create policy "ai_requests_select_own" on public.ai_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_requests_select_admin" on public.ai_requests for select to authenticated using (public.is_admin((select auth.uid())));

-- 3. analytics_events
create policy "analytics_events_insert_any" on public.analytics_events for insert to authenticated with check (user_id is null or (select auth.uid()) = user_id);
create policy "analytics_events_select_admin" on public.analytics_events for select to authenticated using (public.is_admin((select auth.uid())));

-- 4. feature_usage
create policy "feature_usage_insert_own" on public.feature_usage for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "feature_usage_select_admin" on public.feature_usage for select to authenticated using (public.is_admin((select auth.uid())));

-- 5. page_views
create policy "page_views_insert_any" on public.page_views for insert to authenticated with check (user_id is null or (select auth.uid()) = user_id);
create policy "page_views_select_admin" on public.page_views for select to authenticated using (public.is_admin((select auth.uid())));

-- 6. performance_metrics
create policy "performance_metrics_insert_any" on public.performance_metrics for insert to authenticated with check (user_id is null or (select auth.uid()) = user_id);
create policy "performance_metrics_select_admin" on public.performance_metrics for select to authenticated using (public.is_admin((select auth.uid())));

-- Grants for authenticated and service role
grant select, insert on table public.user_attribution to authenticated;
grant select on table public.ai_requests to authenticated;
grant select, insert on table public.analytics_events to authenticated;
grant select, insert on table public.feature_usage to authenticated;
grant select, insert on table public.page_views to authenticated;
grant select, insert on table public.performance_metrics to authenticated;

grant select, insert, update, delete on table public.user_attribution to service_role;
grant select, insert, update, delete on table public.ai_requests to service_role;
grant select, insert, update, delete on table public.analytics_events to service_role;
grant select, insert, update, delete on table public.feature_usage to service_role;
grant select, insert, update, delete on table public.page_views to service_role;
grant select, insert, update, delete on table public.performance_metrics to service_role;

-- 4. Admin query functions
-- Function: get_admin_stats
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
  
  select count(*) into total_docs from public.uploaded_materials where file_type not like 'image%';
  select count(*) into total_images from public.uploaded_materials where file_type like 'image%';

  select count(*) into ai_reqs from public.ai_requests;
  select coalesce(sum(estimated_cost), 0) into ai_cost from public.ai_requests;

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
    'ai_cost', ai_cost
  );
end;
$$;

-- Function: get_admin_users
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
  where (search_query = '' or u.email iLike '%' || search_query || '%' or coalesce(u.raw_user_meta_data->>'full_name', '') iLike '%' || search_query || '%');

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
    (select count(*) from public.uploaded_materials mat where mat.user_id = u.id) as documents_uploaded,
    'Free'::text as current_plan,
    total_users_count as total_count
  from auth.users u
  where (search_query = '' or u.email iLike '%' || search_query || '%' or coalesce(u.raw_user_meta_data->>'full_name', '') iLike '%' || search_query || '%')
  order by u.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- Function: add_admin
create or replace function public.add_admin(target_user_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  
  insert into public.admin_users (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- Function: remove_admin
create or replace function public.remove_admin(target_user_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  
  delete from public.admin_users
  where user_id = target_user_id;
end;
$$;
