-- Migration: SaaS Normalization & Architectural Refactor (2026-07-06)

-- 1. Create user_preferences table
create table if not exists public.user_preferences (
  id uuid primary key references public.profiles(id) on delete cascade,
  teaching_style text not null default 'Intermediate',
  difficulty text not null default 'Medium',
  preferred_language text not null default 'English',
  preferred_quiz_format text not null default 'Mixed',
  flashcard_preference text not null default 'Standard',
  response_length text not null default 'Medium',
  voice_preference text not null default 'Default',
  learning_goals text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create notification_preferences table
create table if not exists public.notification_preferences (
  id uuid primary key references public.profiles(id) on delete cascade,
  product_updates boolean not null default true,
  marketing boolean not null default true,
  security_alerts boolean not null default true,
  study_reminders boolean not null default true,
  announcements boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create user_roles table
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'support', 'moderator', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. Create daily_stats table
create table if not exists public.daily_stats (
  date date primary key default current_date,
  new_users integer not null default 0,
  active_users integer not null default 0,
  documents_uploaded integer not null default 0,
  study_sessions integer not null default 0,
  messages integer not null default 0,
  quizzes integer not null default 0,
  flashcards integer not null default 0,
  hours_studied numeric(10,2) not null default 0.00,
  tokens_used bigint not null default 0,
  storage_used bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Create email_queue table
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'resend',
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  retry_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Create subscriptions table
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  trial_start timestamptz,
  trial_end timestamptz,
  renewal_date timestamptz,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  cancel_at_period_end boolean not null default false,
  payment_provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Alter support_tickets table
alter table public.support_tickets 
  add column if not exists priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  add column if not exists category text not null default 'general',
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists last_reply timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists resolution_notes text;

-- 9. Alter feedback table
alter table public.feedback 
  add column if not exists status text not null default 'new' check (status in ('new', 'under_review', 'planned', 'in_progress', 'completed', 'rejected')),
  add column if not exists admin_notes text;

-- 10. Alter broadcasts table
alter table public.broadcasts 
  add column if not exists target_audience text not null default 'all' check (target_audience in ('all', 'students', 'teachers', 'free', 'premium', 'pro', 'enterprise')),
  add column if not exists target_institution text,
  add column if not exists target_department text;

-- 11. Alter profiles table for soft deletes
alter table public.profiles 
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

-- 12. Enable RLS
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.daily_stats enable row level security;
alter table public.email_queue enable row level security;
alter table public.subscriptions enable row level security;

-- Setup RLS Policies
create policy "preferences_select_own" on public.user_preferences for select to authenticated using (auth.uid() = id);
create policy "preferences_update_own" on public.user_preferences for update to authenticated using (auth.uid() = id);
create policy "preferences_admin_all" on public.user_preferences for all to authenticated using (public.is_admin(auth.uid()));

create policy "notifications_select_own" on public.notification_preferences for select to authenticated using (auth.uid() = id);
create policy "notifications_update_own" on public.notification_preferences for update to authenticated using (auth.uid() = id);
create policy "notifications_admin_all" on public.notification_preferences for all to authenticated using (public.is_admin(auth.uid()));

create policy "roles_select_all" on public.user_roles for select to authenticated using (true);
create policy "roles_admin_all" on public.user_roles for all to authenticated using (public.is_admin(auth.uid()));

create policy "events_select_own" on public.events for select to authenticated using (auth.uid() = user_id);
create policy "events_insert_all" on public.events for insert to authenticated with check (auth.uid() = user_id);
create policy "events_admin_all" on public.events for all to authenticated using (public.is_admin(auth.uid()));

create policy "daily_stats_admin_select" on public.daily_stats for select to authenticated using (public.is_admin(auth.uid()));

create policy "email_queue_admin_all" on public.email_queue for all to authenticated using (public.is_admin(auth.uid()));

create policy "subscriptions_select_own" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "subscriptions_admin_all" on public.subscriptions for all to authenticated using (public.is_admin(auth.uid()));

-- Setup Grants
grant select, insert, update on table public.user_preferences to authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select on table public.user_roles to authenticated;
grant select, insert on table public.events to authenticated;
grant select on table public.subscriptions to authenticated;

grant all on table public.user_preferences to service_role;
grant all on table public.notification_preferences to service_role;
grant all on table public.user_roles to service_role;
grant all on table public.events to service_role;
grant all on table public.daily_stats to service_role;
grant all on table public.email_queue to service_role;
grant all on table public.subscriptions to service_role;

-- 13. Centralized Roles Hierarchy checking
create or replace function public.has_role_hierarchy(user_id uuid, min_role text)
returns boolean as $$
declare
  user_role text;
  user_weight int;
  req_weight int;
begin
  select coalesce(
    (select role from public.user_roles where user_roles.user_id = $1),
    'user'
  ) into user_role;

  user_weight := case user_role
    when 'user' then 1
    when 'support' then 2
    when 'moderator' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 1
  end;

  req_weight := case min_role
    when 'user' then 1
    when 'support' then 2
    when 'moderator' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 1
  end;

  return user_weight >= req_weight;
end;
$$ language plpgsql security definer;

-- Redefine is_admin to use has_role_hierarchy
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return public.has_role_hierarchy($1, 'admin');
end;
$$ language plpgsql security definer;

-- 14. Data Backfilling
-- Migrate preferences
insert into public.user_preferences (
  id, teaching_style, difficulty, preferred_language, preferred_quiz_format, flashcard_preference, response_length, voice_preference, learning_goals
)
select 
  id, 
  coalesce(teaching_style, 'Intermediate'), 
  coalesce(difficulty, 'Medium'), 
  coalesce(preferred_language, 'English'), 
  coalesce(preferred_quiz_format, 'Mixed'), 
  coalesce(flashcard_preference, 'Standard'), 
  coalesce(response_length, 'Medium'), 
  coalesce(voice_preference, 'Default'), 
  coalesce(study_goals, '{}'::text[])
from public.profiles
on conflict (id) do nothing;

-- Migrate notifications
insert into public.notification_preferences (
  id, product_updates, marketing, security_alerts, study_reminders, announcements
)
select 
  id, 
  coalesce(marketing_updates_enabled, true), 
  coalesce(marketing_updates_enabled, true), 
  coalesce(security_alerts_enabled, true), 
  coalesce(study_reminder_enabled, true), 
  true
from public.profiles
on conflict (id) do nothing;

-- Migrate subscriptions
insert into public.subscriptions (
  user_id, plan, status, billing_cycle
)
select 
  id, 
  coalesce(plan, 'free'), 
  'active', 
  'monthly'
from public.profiles
on conflict (user_id) do nothing;

-- Migrate roles
insert into public.user_roles (user_id, role)
select 
  p.id, 
  case when exists (select 1 from public.admin_users au where au.user_id = p.id) then 'admin'::text else 'user'::text end
from public.profiles p
on conflict (user_id) do nothing;

-- 15. Refactor triggers for onboarding / signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_first text;
  user_last text;
  user_avatar text;
begin
  user_first := coalesce(split_part(new.raw_user_meta_data->>'full_name', ' ', 1), '');
  user_last := coalesce(substring(new.raw_user_meta_data->>'full_name' from '^[^\s]+\s+(.*)$'), '');
  user_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', '');

  -- 1. Create identity profile
  insert into public.profiles (
    id, email, first_name, last_name, avatar_url, onboarding_completed, is_deleted
  )
  values (
    new.id, new.email, user_first, user_last, user_avatar, false, false
  )
  on conflict (id) do nothing;

  -- 2. Create preferences row
  insert into public.user_preferences (id) values (new.id) on conflict (id) do nothing;

  -- 3. Create notifications row
  insert into public.notification_preferences (id) values (new.id) on conflict (id) do nothing;

  -- 4. Create subscriptions row
  insert into public.subscriptions (user_id, plan) values (new.id, 'free') on conflict (user_id) do nothing;

  -- 5. Create default role row
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Remove old preferences and billing columns from profiles to keep it normalized
alter table public.profiles 
  drop column if exists teaching_style,
  drop column if exists difficulty,
  drop column if exists preferred_quiz_format,
  drop column if exists preferred_question_type,
  drop column if exists flashcard_preference,
  drop column if exists preferred_language,
  drop column if exists response_length,
  drop column if exists voice_preference,
  drop column if exists study_goals,
  drop column if exists marketing_updates_enabled,
  drop column if exists security_alerts_enabled,
  drop column if exists study_reminder_enabled,
  drop column if exists plan,
  drop column if exists daily_goal_minutes,
  drop column if exists preferred_theme;

-- 16. Soft Delete User RPC
create or replace function public.admin_toggle_soft_delete(target_user_id uuid, delete_status boolean)
returns boolean
security definer
language plpgsql
as $$
declare
  action_label text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  update public.profiles
  set is_deleted = delete_status,
      deleted_at = case when delete_status = true then now() else null end,
      updated_at = now()
  where id = target_user_id;

  action_label := case when delete_status = true then 'user_soft_deleted' else 'user_restored' end;

  insert into public.events (user_id, event_type, properties)
  values (
    auth.uid(),
    action_label,
    jsonb_build_object('target_user_id', target_user_id)
  );

  return true;
end;
$$;

-- Redefine admin_delete_user to perform soft-delete
create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
security definer
language plpgsql
as $$
begin
  return public.admin_toggle_soft_delete(target_user_id, true);
end;
$$;

-- Admin: Change Role (Promote/Demote)
create or replace function public.admin_change_role(target_user_id uuid, new_role text)
returns boolean
security definer
language plpgsql
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  insert into public.user_roles (user_id, role, updated_at)
  values (target_user_id, new_role, now())
  on conflict (user_id) do update set
    role = excluded.role,
    updated_at = now();

  insert into public.events (user_id, event_type, properties)
  values (
    auth.uid(),
    'role_changed',
    jsonb_build_object('target_user_id', target_user_id, 'new_role', new_role)
  );

  return true;
end;
$$;

-- 17. Cached Demographics Calculations helper
create or replace function public.recalculate_daily_stats(target_date date)
returns void as $$
declare
  users_count integer;
  active_count integer;
  docs_count integer;
  sessions_count integer;
  msgs_count integer;
  quizzes_count integer;
  flashcards_count integer;
  hours_studied_sum numeric(10,2);
  tokens_sum bigint;
  storage_sum bigint;
begin
  select count(*) into users_count from public.profiles where created_at::date = target_date;
  select count(distinct user_id) into active_count from public.page_views where created_at::date = target_date;
  select count(*) into docs_count from public.uploaded_materials where created_at::date = target_date and deleted_at is null;
  select count(*) into sessions_count from public.study_sessions where created_at::date = target_date;
  select count(*) into msgs_count from public.study_messages where created_at::date = target_date;
  select count(*) into quizzes_count from public.quizzes where created_at::date = target_date;
  select count(*) into flashcards_count from public.flashcards where created_at::date = target_date;
  select coalesce(sum(duration_minutes / 60.0), 0.00) into hours_studied_sum from public.study_sessions where created_at::date = target_date;
  select coalesce(sum(total_tokens), 0) into tokens_sum from public.ai_requests where created_at::date = target_date;
  select coalesce(sum(file_size), 0) into storage_sum from public.uploaded_materials where created_at::date = target_date and deleted_at is null;

  insert into public.daily_stats (
    date, new_users, active_users, documents_uploaded, study_sessions, messages, quizzes, flashcards, hours_studied, tokens_used, storage_used, updated_at
  )
  values (
    target_date, users_count, active_count, docs_count, sessions_count, msgs_count, quizzes_count, flashcards_count, hours_studied_sum, tokens_sum, storage_sum, now()
  )
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
    updated_at = now();
end;
$$ language plpgsql security definer;

-- Redefine get_admin_users
create or replace function public.get_admin_users(
  search_query text default '',
  filter_plan text default 'all',
  filter_institution text default 'all',
  filter_department text default 'all',
  filter_status text default 'all',
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
  institution text,
  department text,
  country text,
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
  from public.profiles p
  left join public.subscriptions s on p.id = s.user_id
  left join public.user_roles r on p.id = r.user_id
  where 
    (search_query = '' or p.email iLike '%' || search_query || '%' or p.first_name iLike '%' || search_query || '%' or p.last_name iLike '%' || search_query || '%')
    and (filter_plan = 'all' or s.plan = filter_plan)
    and (filter_institution = 'all' or p.institution = filter_institution)
    and (filter_department = 'all' or p.department = filter_department)
    and (
      filter_status = 'all' or
      (filter_status = 'Deleted' and p.is_deleted = true) or
      (filter_status = 'Suspended' and p.is_deleted = false and p.is_suspended = true) or
      (filter_status = 'Admin' and p.is_deleted = false and p.is_suspended = false and r.role in ('admin', 'owner')) or
      (filter_status = 'Active' and p.is_deleted = false and p.is_suspended = false and r.role = 'user')
    );

  return query
  select 
    p.id,
    (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))::text as name,
    p.email::text,
    coalesce(u.raw_app_meta_data->>'provider', 'email')::text as provider,
    p.created_at as joined_date,
    p.last_active as last_login,
    case 
      when p.is_deleted = true then 'Deleted'::text
      when p.is_suspended = true then 'Suspended'::text
      when r.role in ('admin', 'owner') then 'Admin'::text 
      else 'Active'::text 
    end as status,
    (select count(*) from public.study_sessions ss where ss.user_id = p.id) as total_sessions,
    (select count(*) from public.study_messages sm where sm.user_id = p.id) as total_messages,
    (select count(*) from public.uploaded_materials mat where mat.user_id = p.id and mat.deleted_at is null) as documents_uploaded,
    coalesce(s.plan, 'free')::text as current_plan,
    p.institution::text,
    p.department::text,
    p.country::text,
    total_users_count as total_count
  from public.profiles p
  left join auth.users u on p.id = u.id
  left join public.subscriptions s on p.id = s.user_id
  left join public.user_roles r on p.id = r.user_id
  where 
    (search_query = '' or p.email iLike '%' || search_query || '%' or p.first_name iLike '%' || search_query || '%' or p.last_name iLike '%' || search_query || '%')
    and (filter_plan = 'all' or s.plan = filter_plan)
    and (filter_institution = 'all' or p.institution = filter_institution)
    and (filter_department = 'all' or p.department = filter_department)
    and (
      filter_status = 'all' or
      (filter_status = 'Deleted' and p.is_deleted = true) or
      (filter_status = 'Suspended' and p.is_deleted = false and p.is_suspended = true) or
      (filter_status = 'Admin' and p.is_deleted = false and p.is_suspended = false and r.role in ('admin', 'owner')) or
      (filter_status = 'Active' and p.is_deleted = false and p.is_suspended = false and r.role = 'user')
    )
  order by p.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- Redefine get_admin_user_details
create or replace function public.get_admin_user_details(target_user_id uuid)
returns json
security definer
language plpgsql
as $$
declare
  user_email text;
  user_first_name text;
  user_last_name text;
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
  
  -- Profile fields
  user_gender text;
  user_age integer;
  user_is_student boolean;
  user_institution text;
  user_department text;
  user_study_level text;
  user_study_goals text[];
  user_teaching_style text;
  user_preferred_quiz_format text;
  user_preferred_language text;
  
  -- Extra lists
  user_tickets json;
  user_feedbacks json;
  user_logins json;
  user_role text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  -- Fetch role
  select role into user_role from public.user_roles where user_id = target_user_id;

  -- Fetch user profile columns
  select 
    p.email::text, 
    coalesce(p.first_name, ''),
    coalesce(p.last_name, ''),
    coalesce(u.raw_app_meta_data->>'provider', 'email')::text,
    p.created_at,
    p.last_active,
    case 
      when p.is_deleted = true then 'Deleted'
      when p.is_suspended = true then 'Suspended'
      when r.role in ('admin', 'owner') then 'Admin' 
      else 'Active' 
    end,
    coalesce(s.plan, 'free'),
    p.gender,
    p.age,
    p.is_student,
    p.institution,
    p.department,
    p.study_level,
    pref.learning_goals,
    pref.teaching_style,
    pref.preferred_quiz_format,
    pref.preferred_language
  into 
    user_email, user_first_name, user_last_name, user_provider, user_joined, user_last_login, user_status, user_plan,
    user_gender, user_age, user_is_student, user_institution, user_department, user_study_level, user_study_goals,
    user_teaching_style, user_preferred_quiz_format, user_preferred_language
  from public.profiles p
  left join auth.users u on p.id = u.id
  left join public.subscriptions s on p.id = s.user_id
  left join public.user_roles r on p.id = r.user_id
  left join public.user_preferences pref on p.id = pref.id
  where p.id = target_user_id;

  if user_email is null then
    return null;
  end if;

  -- Fetch Sessions
  select coalesce(json_agg(t), '[]'::json) into user_sessions from (
    select id, title, topic_category, status, created_at, updated_at
    from public.study_sessions
    where user_id = target_user_id
    order by updated_at desc
  ) t;

  -- Fetch Uploads
  select coalesce(json_agg(t), '[]'::json) into user_uploads from (
    select id, file_name, file_type, created_at, coalesce(file_size, 0) as file_size, ocr_status, embedding_status
    from public.uploaded_materials
    where user_id = target_user_id and deleted_at is null
    order by created_at desc
  ) t;

  -- Sum storage usage
  select coalesce(sum(file_size), 0) into storage_usage_bytes
  from public.uploaded_materials
  where user_id = target_user_id and deleted_at is null;

  -- Fetch AI usage stats
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

  -- Fetch User Attribution
  select row_to_json(t) into user_attribution from (
    select utm_source, utm_medium, utm_campaign, referrer, created_at
    from public.user_attribution
    where user_id = target_user_id
  ) t;

  -- Detect device from last page view
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

  -- Count quizzes and notes
  select count(*) into total_quizzes_count from public.quizzes where user_id = target_user_id;
  select count(*) into total_notes_count from public.notes where user_id = target_user_id;

  -- Fetch Support Tickets
  select coalesce(json_agg(t), '[]'::json) into user_tickets from (
    select id, subject, message, status, created_at, priority, category
    from public.support_tickets
    where user_id = target_user_id
    order by created_at desc
  ) t;

  -- Fetch Feedback
  select coalesce(json_agg(t), '[]'::json) into user_feedbacks from (
    select id, type, message, rating, created_at, status
    from public.feedback
    where user_id = target_user_id
    order by created_at desc
  ) t;

  -- Recent Pageviews for Login History
  select coalesce(json_agg(t), '[]'::json) into user_logins from (
    select id, path, user_agent, created_at
    from public.page_views
    where user_id = target_user_id
    order by created_at desc
    limit 10
  ) t;

  return json_build_object(
    'profile', json_build_object(
      'id', target_user_id,
      'firstName', user_first_name,
      'lastName', user_last_name,
      'email', user_email,
      'provider', user_provider,
      'joinedDate', user_joined,
      'lastLogin', coalesce(user_last_login, user_joined),
      'status', user_status,
      'device', user_device,
      'subscriptionStatus', user_plan,
      'storageUsageBytes', storage_usage_bytes,
      'totalQuizzes', total_quizzes_count,
      'totalNotes', total_notes_count,
      'gender', user_gender,
      'age', user_age,
      'isStudent', user_is_student,
      'institution', user_institution,
      'department', user_department,
      'studyLevel', user_study_level,
      'studyGoals', user_study_goals,
      'role', coalesce(user_role, 'user')
    ),
    'preferences', json_build_object(
      'teachingStyle', user_teaching_style,
      'preferredQuizFormat', user_preferred_quiz_format,
      'preferredLanguage', user_preferred_language
    ),
    'attribution', user_attribution,
    'sessions', user_sessions,
    'uploads', user_uploads,
    'supportTickets', user_tickets,
    'feedback', user_feedbacks,
    'loginHistory', user_logins,
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

-- Redefine get_admin_stats
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
  
  -- Demographics & Aggregates
  students_count integer;
  teachers_count integer;
  countries_agg json;
  universities_agg json;
  departments_agg json;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into total_users from public.profiles where is_deleted = false;
  select count(*) into new_users_today from public.profiles where created_at >= now() - interval '24 hours' and is_deleted = false;
  select count(*) into active_users_today from public.profiles where last_active >= now() - interval '24 hours' and is_deleted = false;
  select count(*) into mau from public.profiles where last_active >= now() - interval '30 days' and is_deleted = false;

  select count(*) into total_sessions from public.study_sessions;
  select count(*) into total_messages from public.study_messages;
  
  select count(*) into total_docs from public.uploaded_materials where file_type not like 'image%' and deleted_at is null;
  select count(*) into total_images from public.uploaded_materials where file_type like 'image%' and deleted_at is null;

  select count(*) into ai_reqs from public.ai_requests;
  select coalesce(sum(estimated_cost), 0.0) into ai_cost from public.ai_requests;

  select count(*) into premium_users from public.subscriptions where plan = 'premium' or plan = 'pro';
  select (premium_users * 12.00) into revenue;

  select coalesce(sum(r.total_tokens), 0) into total_tokens from public.ai_requests r;
  select coalesce(
    (count(case when status = 'success' then 1 end) * 100.0) / nullif(count(*), 0),
    100.0
  )::numeric(5,1) into success_rate
  from public.ai_requests;

  -- Compute demographics
  select count(*) into students_count from public.profiles where is_student = true and is_deleted = false;
  select count(*) into teachers_count from public.profiles where account_type = 'Teacher' and is_deleted = false;

  -- Country aggregates
  select coalesce(json_agg(t), '[]'::json) into countries_agg from (
    select country as label, count(*) as value
    from public.profiles
    where country is not null and is_deleted = false
    group by country
    order by count(*) desc
    limit 5
  ) t;

  -- University aggregates
  select coalesce(json_agg(t), '[]'::json) into universities_agg from (
    select institution as label, count(*) as value
    from public.profiles
    where institution is not null and institution != '' and is_deleted = false
    group by institution
    order by count(*) desc
    limit 5
  ) t;

  -- Department aggregates
  select coalesce(json_agg(t), '[]'::json) into departments_agg from (
    select department as label, count(*) as value
    from public.profiles
    where department is not null and department != '' and is_deleted = false
    group by department
    order by count(*) desc
    limit 5
  ) t;

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
    'success_rate', success_rate,
    'students_count', students_count,
    'teachers_count', teachers_count,
    'countries', countries_agg,
    'universities', universities_agg,
    'departments', departments_agg
  );
end;
$$;
