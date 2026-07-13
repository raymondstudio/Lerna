-- 1. Idempotent Backfill: Create missing profiles for auth.users
insert into public.profiles (id, email, first_name, last_name, avatar_url, onboarding_completed, is_deleted)
select 
  u.id, 
  u.email,
  coalesce(split_part(u.raw_user_meta_data->>'full_name', ' ', 1), ''),
  coalesce(substring(u.raw_user_meta_data->>'full_name' from '^[^\s]+\s+(.*)$'), ''),
  coalesce(u.raw_user_meta_data->>'avatar_url', ''),
  false,
  false
from auth.users u
left join public.profiles p on u.id = p.id
where p.id is null
on conflict (id) do nothing;

-- 2. Idempotent Backfill: Create user_preferences
insert into public.user_preferences (id)
select id from public.profiles
on conflict (id) do nothing;

-- 3. Idempotent Backfill: Create notification_preferences
insert into public.notification_preferences (id)
select id from public.profiles
on conflict (id) do nothing;

-- 4. Idempotent Backfill: Create subscriptions
insert into public.subscriptions (user_id, plan)
select id, 'free' from public.profiles
on conflict (user_id) do nothing;

-- 5. Idempotent Backfill: Create user_roles
insert into public.user_roles (user_id, role)
select id, 'user' from public.profiles
on conflict (user_id) do nothing;

-- Upgrade known admin accounts to 'admin' role
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles
where email in ('msuraymond@gmail.com')
on conflict (user_id) do update set role = 'admin';

-- Redefine public.is_admin helper to support role hierarchy and fallback emails
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return public.has_role_hierarchy($1, 'admin') or exists (
    select 1 from auth.users u where u.id = $1 and (
      u.email = 'msuraymond@gmail.com' or 
      u.email = 'msuraymond@gmail.com'
    )
  );
end;
$$ language plpgsql security definer;



-- 6. Refactor RPC: get_admin_users
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
    and (filter_plan = 'all' or coalesce(s.plan, 'free') = filter_plan)
    and (filter_institution = 'all' or p.institution = filter_institution)
    and (filter_department = 'all' or p.department = filter_department)
    and (
      filter_status = 'all' or
      (filter_status = 'Deleted' and p.is_deleted = true) or
      (filter_status = 'Suspended' and p.is_deleted = false and p.is_suspended = true) or
      (filter_status = 'Admin' and p.is_deleted = false and p.is_suspended = false and coalesce(r.role, 'user') in ('admin', 'owner')) or
      (filter_status = 'Active' and p.is_deleted = false and p.is_suspended = false and coalesce(r.role, 'user') = 'user')
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
      when coalesce(r.role, 'user') in ('admin', 'owner') then 'Admin'::text 
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
    and (filter_plan = 'all' or coalesce(s.plan, 'free') = filter_plan)
    and (filter_institution = 'all' or p.institution = filter_institution)
    and (filter_department = 'all' or p.department = filter_department)
    and (
      filter_status = 'all' or
      (filter_status = 'Deleted' and p.is_deleted = true) or
      (filter_status = 'Suspended' and p.is_deleted = false and p.is_suspended = true) or
      (filter_status = 'Admin' and p.is_deleted = false and p.is_suspended = false and coalesce(r.role, 'user') in ('admin', 'owner')) or
      (filter_status = 'Active' and p.is_deleted = false and p.is_suspended = false and coalesce(r.role, 'user') = 'user')
    )
  order by p.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;


-- 7. Refactor RPC: get_admin_user_details
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
  select coalesce(role, 'user') into user_role from public.user_roles where user_id = target_user_id;

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
      when coalesce(r.role, 'user') in ('admin', 'owner') then 'Admin' 
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


-- 8. Refactor RPC: get_admin_stats
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
  
  total_profiles integer;
  
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

  select count(*) into total_users from auth.users;
  select count(*) into total_profiles from public.profiles;
  select count(*) into new_users_today from auth.users where created_at >= now() - interval '24 hours';
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

  -- University aggregates (.edu etc)
  select coalesce(json_agg(t), '[]'::json) into universities_agg from (
    select split_part(email, '@', 2) as label, count(*) as value
    from public.profiles
    where email like '%@%.edu' or email like '%@%.ac.%' or email like '%@%.org' and is_deleted = false
    group by split_part(email, '@', 2)
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
    'total_profiles', total_profiles,
    'new_users_today', new_users_today,
    'active_users_today', active_users_today,
    'mau', mau,
    'total_sessions', total_sessions,
    'total_messages', total_messages,
    'total_docs', total_docs,
    'total_images', total_images,
    'ai_requests', ai_reqs,
    'ai_cost', ai_cost::numeric(12,4),
    'revenue', revenue::numeric(12,2),
    'premium_users', premium_users,
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


-- 9. Check system health diagnostics RPC
create or replace function public.check_system_health()
returns json
security definer
language plpgsql
as $$
declare
  missing_profiles bigint;
  missing_preferences bigint;
  missing_notifications bigint;
  missing_roles bigint;
  missing_subscriptions bigint;
  duplicate_profiles bigint;
  duplicate_roles bigint;
  orphan_sessions bigint;
  failed_queue bigint;
  db_ok boolean := true;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into missing_profiles 
  from auth.users u 
  left join public.profiles p on u.id = p.id 
  where p.id is null;

  select count(*) into missing_preferences 
  from public.profiles p 
  left join public.user_preferences pr on p.id = pr.id 
  where pr.id is null;

  select count(*) into missing_notifications 
  from public.profiles p 
  left join public.notification_preferences n on p.id = n.id 
  where n.id is null;

  select count(*) into missing_roles 
  from public.profiles p 
  left join public.user_roles r on p.id = r.user_id 
  where r.user_id is null;

  select count(*) into missing_subscriptions 
  from public.profiles p 
  left join public.subscriptions s on p.id = s.user_id 
  where s.user_id is null;

  select count(*) into duplicate_profiles 
  from (select id from public.profiles group by id having count(*) > 1) t;

  select count(*) into duplicate_roles 
  from (select user_id from public.user_roles group by user_id having count(*) > 1) t;

  select count(*) into orphan_sessions 
  from public.study_sessions ss 
  left join public.profiles p on ss.user_id = p.id 
  where p.id is null;

  select count(*) into failed_queue 
  from public.email_queue 
  where status = 'failed';

  return json_build_object(
    'missingProfiles', missing_profiles,
    'missingPreferences', missing_preferences,
    'missingNotifications', missing_notifications,
    'missingRoles', missing_roles,
    'missingSubscriptions', missing_subscriptions,
    'duplicateProfiles', duplicate_profiles,
    'duplicateRoles', duplicate_roles,
    'orphanSessions', orphan_sessions,
    'failedQueue', failed_queue,
    'databaseHealth', db_ok
  );
end;
$$;


-- 10. Database Index Performance Optimization
create index if not exists idx_events_user_id_created_at on public.events(user_id, created_at desc);
create index if not exists idx_ai_requests_user_id_created_at on public.ai_requests(user_id, created_at desc);
create index if not exists idx_ai_requests_latency_ms on public.ai_requests(latency_ms) where latency_ms is not null;
create index if not exists idx_user_roles_user_id_role on public.user_roles(user_id, role);
create index if not exists idx_subscriptions_user_id_plan_status on public.subscriptions(user_id, plan, status);
create index if not exists idx_profiles_last_active_created_at on public.profiles(last_active desc, created_at desc);
create index if not exists idx_uploaded_materials_user_session on public.uploaded_materials(user_id, session_id);


-- 11. Unified Admin Roles toggles
create or replace function public.add_admin(target_user_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  
  insert into public.user_roles (user_id, role)
  values (target_user_id, 'admin')
  on conflict (user_id) do update set role = 'admin';
end;
$$;

create or replace function public.remove_admin(target_user_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  
  insert into public.user_roles (user_id, role)
  values (target_user_id, 'user')
  on conflict (user_id) do update set role = 'user';
end;
$$;
