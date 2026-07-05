-- Migration: SaaS User Profiles, Tickets, Feedback, Broadcasts & Audit Logs (2026-07-06)

-- 1. Alter profiles table to add preferences & suspension metadata
alter table public.profiles 
  add column if not exists is_student boolean not null default true,
  add column if not exists gender text,
  add column if not exists age integer,
  add column if not exists difficulty text not null default 'Medium',
  add column if not exists preferred_quiz_format text not null default 'Mixed',
  add column if not exists flashcard_preference text not null default 'Standard',
  add column if not exists preferred_language text not null default 'English',
  add column if not exists response_length text not null default 'Medium',
  add column if not exists voice_preference text not null default 'Default',
  add column if not exists is_suspended boolean not null default false,
  add column if not exists marketing_updates_enabled boolean not null default true,
  add column if not exists security_alerts_enabled boolean not null default true;

-- 2. Create support_tickets table
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'pending', 'resolved')),
  assignee_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create feedback table
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('general', 'bug', 'feature')),
  message text not null,
  rating integer check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now()
);

-- 4. Create broadcasts table
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 5. Create audit_logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. Enable RLS and define security policies
alter table public.support_tickets enable row level security;
alter table public.feedback enable row level security;
alter table public.broadcasts enable row level security;
alter table public.audit_logs enable row level security;

-- Support Tickets Policies
create policy "tickets_select_own" on public.support_tickets
  for select to authenticated using (auth.uid() = user_id);
create policy "tickets_insert_own" on public.support_tickets
  for insert to authenticated with check (auth.uid() = user_id);
create policy "tickets_admin_all" on public.support_tickets
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Feedback Policies
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);
create policy "feedback_admin_select" on public.feedback
  for select to authenticated using (public.is_admin(auth.uid()));

-- Broadcasts Policies
create policy "broadcasts_select_all" on public.broadcasts
  for select to authenticated using (true);
create policy "broadcasts_admin_all" on public.broadcasts
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Audit Logs Policies
create policy "audit_logs_admin_select" on public.audit_logs
  for select to authenticated using (public.is_admin(auth.uid()));

-- Grant table privileges
grant select, insert, update on table public.support_tickets to authenticated;
grant select, insert on table public.feedback to authenticated;
grant select on table public.broadcasts to authenticated;

grant all on table public.support_tickets to service_role;
grant all on table public.feedback to service_role;
grant all on table public.broadcasts to service_role;
grant all on table public.audit_logs to service_role;

-- 7. Trigger to log profile updates automatically
create or replace function public.log_profile_update()
returns trigger as $$
begin
  insert into public.audit_logs (user_id, action, details)
  values (
    new.id, 
    'profile_updated', 
    jsonb_build_object(
      'old_name', coalesce(old.first_name, '') || ' ' || coalesce(old.last_name, ''),
      'new_name', coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, ''),
      'old_institution', old.institution,
      'new_institution', new.institution,
      'old_is_suspended', old.is_suspended,
      'new_is_suspended', new.is_suspended
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_log_profile_update on public.profiles;
create trigger tr_log_profile_update
  after update on public.profiles
  for each row
  when (
    old.first_name is distinct from new.first_name or 
    old.last_name is distinct from new.last_name or
    old.institution is distinct from new.institution or
    old.department is distinct from new.department or
    old.is_suspended is distinct from new.is_suspended
  )
  execute procedure public.log_profile_update();

-- 8. Administrative RPC functions
-- Admin: Delete User
create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
security definer
language plpgsql
as $$
declare
  performer_email text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select email into performer_email from auth.users where id = auth.uid();

  -- Log action
  insert into public.audit_logs (user_id, action, details)
  values (
    auth.uid(),
    'user_deleted',
    jsonb_build_object('deleted_user_id', target_user_id, 'performed_by', performer_email)
  );

  -- Delete from auth.users (cascades to profiles and study history)
  delete from auth.users where id = target_user_id;
  return true;
end;
$$;

-- Admin: Toggle Suspension
create or replace function public.admin_toggle_suspension(target_user_id uuid, suspend_status boolean)
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
  set is_suspended = suspend_status,
      updated_at = now()
  where id = target_user_id;

  action_label := case when suspend_status = true then 'user_suspended' else 'user_restored' end;
  
  insert into public.audit_logs (user_id, action, details)
  values (
    auth.uid(),
    action_label,
    jsonb_build_object('target_user_id', target_user_id)
  );

  return true;
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

  if new_role = 'admin' then
    insert into public.admin_users (user_id) values (target_user_id) on conflict do nothing;
  else
    delete from public.admin_users where user_id = target_user_id;
  end if;

  insert into public.audit_logs (user_id, action, details)
  values (
    auth.uid(),
    'role_changed',
    jsonb_build_object('target_user_id', target_user_id, 'new_role', new_role)
  );

  return true;
end;
$$;

-- 9. Redefine list RPCs to support filters and profiles
-- Redefine: get_admin_users
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
  where 
    (search_query = '' or p.email iLike '%' || search_query || '%' or p.first_name iLike '%' || search_query || '%' or p.last_name iLike '%' || search_query || '%')
    and (filter_plan = 'all' or p.plan = filter_plan)
    and (filter_institution = 'all' or p.institution = filter_institution)
    and (filter_department = 'all' or p.department = filter_department)
    and (
      filter_status = 'all' or
      (filter_status = 'Suspended' and p.is_suspended = true) or
      (filter_status = 'Admin' and p.is_suspended = false and exists (select 1 from public.admin_users au where au.user_id = p.id)) or
      (filter_status = 'Active' and p.is_suspended = false and not exists (select 1 from public.admin_users au where au.user_id = p.id))
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
      when p.is_suspended = true then 'Suspended'::text
      when exists (select 1 from public.admin_users au where au.user_id = p.id) then 'Admin'::text 
      else 'Active'::text 
    end as status,
    (select count(*) from public.study_sessions s where s.user_id = p.id) as total_sessions,
    (select count(*) from public.study_messages sm where sm.user_id = p.id) as total_messages,
    (select count(*) from public.uploaded_materials mat where mat.user_id = p.id and mat.deleted_at is null) as documents_uploaded,
    p.plan::text as current_plan,
    p.institution::text,
    p.department::text,
    p.country::text,
    total_users_count as total_count
  from public.profiles p
  left join auth.users u on p.id = u.id
  where 
    (search_query = '' or p.email iLike '%' || search_query || '%' or p.first_name iLike '%' || search_query || '%' or p.last_name iLike '%' || search_query || '%')
    and (filter_plan = 'all' or p.plan = filter_plan)
    and (filter_institution = 'all' or p.institution = filter_institution)
    and (filter_department = 'all' or p.department = filter_department)
    and (
      filter_status = 'all' or
      (filter_status = 'Suspended' and p.is_suspended = true) or
      (filter_status = 'Admin' and p.is_suspended = false and exists (select 1 from public.admin_users au where au.user_id = p.id)) or
      (filter_status = 'Active' and p.is_suspended = false and not exists (select 1 from public.admin_users au where au.user_id = p.id))
    )
  order by p.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- Redefine: get_admin_user_details
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
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  -- 1. Fetch user profile columns
  select 
    p.email::text, 
    coalesce(p.first_name, ''),
    coalesce(p.last_name, ''),
    coalesce(u.raw_app_meta_data->>'provider', 'email')::text,
    p.created_at,
    p.last_active,
    case 
      when p.is_suspended = true then 'Suspended'
      when exists (select 1 from public.admin_users au where au.user_id = target_user_id) then 'Admin' 
      else 'Active' 
    end,
    p.plan,
    p.gender,
    p.age,
    p.is_student,
    p.institution,
    p.department,
    p.study_level,
    p.study_goals,
    p.teaching_style,
    p.preferred_quiz_format,
    p.preferred_language
  into 
    user_email, user_first_name, user_last_name, user_provider, user_joined, user_last_login, user_status, user_plan,
    user_gender, user_age, user_is_student, user_institution, user_department, user_study_level, user_study_goals,
    user_teaching_style, user_preferred_quiz_format, user_preferred_language
  from public.profiles p
  left join auth.users u on p.id = u.id
  where p.id = target_user_id;

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
    select id, file_name, file_type, created_at, coalesce(file_size, 0) as file_size, ocr_status, embedding_status
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

  -- 8. Fetch Support Tickets
  select coalesce(json_agg(t), '[]'::json) into user_tickets from (
    select id, subject, message, status, created_at
    from public.support_tickets
    where user_id = target_user_id
    order by created_at desc
  ) t;

  -- 9. Fetch Feedback
  select coalesce(json_agg(t), '[]'::json) into user_feedbacks from (
    select id, type, message, rating, created_at
    from public.feedback
    where user_id = target_user_id
    order by created_at desc
  ) t;

  -- 10. Recent Pageviews for Login History
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
      'studyGoals', user_study_goals
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

-- Redefine: get_admin_stats
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
  top_goals_agg json;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into total_users from public.profiles;
  select count(*) into new_users_today from public.profiles where created_at >= now() - interval '24 hours';
  select count(*) into active_users_today from public.profiles where last_active >= now() - interval '24 hours';
  select count(*) into mau from public.profiles where last_active >= now() - interval '30 days';

  select count(*) into total_sessions from public.study_sessions;
  select count(*) into total_messages from public.study_messages;
  
  select count(*) into total_docs from public.uploaded_materials where file_type not like 'image%' and deleted_at is null;
  select count(*) into total_images from public.uploaded_materials where file_type like 'image%' and deleted_at is null;

  select count(*) into ai_reqs from public.ai_requests;
  select coalesce(sum(estimated_cost), 0.0) into ai_cost from public.ai_requests;

  select count(*) into premium_users from public.profiles where plan = 'premium' or plan = 'pro';
  select (premium_users * 12.00) into revenue;

  select coalesce(sum(r.total_tokens), 0) into total_tokens from public.ai_requests r;
  select coalesce(
    (count(case when status = 'success' then 1 end) * 100.0) / nullif(count(*), 0),
    100.0
  )::numeric(5,1) into success_rate
  from public.ai_requests;

  -- Compute demographics
  select count(*) into students_count from public.profiles where is_student = true;
  select count(*) into teachers_count from public.profiles where account_type = 'Teacher';

  -- Country aggregates
  select coalesce(json_agg(t), '[]'::json) into countries_agg from (
    select country as label, count(*) as value
    from public.profiles
    where country is not null
    group by country
    order by count(*) desc
    limit 5
  ) t;

  -- University aggregates
  select coalesce(json_agg(t), '[]'::json) into universities_agg from (
    select institution as label, count(*) as value
    from public.profiles
    where institution is not null and institution != ''
    group by institution
    order by count(*) desc
    limit 5
  ) t;

  -- Department aggregates
  select coalesce(json_agg(t), '[]'::json) into departments_agg from (
    select department as label, count(*) as value
    from public.profiles
    where department is not null and department != ''
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
