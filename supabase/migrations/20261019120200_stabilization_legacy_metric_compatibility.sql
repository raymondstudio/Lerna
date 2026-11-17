-- Preserve the existing KPI envelope while removing fabricated revenue and success.
create or replace function public.get_admin_stats()
returns json
security definer
language plpgsql
set search_path = ''
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

  select count(*) into ai_reqs from public.ai_requests where authoritative_outcome in ('succeeded','failed','legacy_unverified');
  select case when count(*) filter(where estimated_cost is null)>0 then null else coalesce(sum(estimated_cost),0) end into ai_cost from public.ai_requests where authoritative_outcome<>'simulated';

  select count(*) into premium_users from public.subscriptions where plan = 'premium' or plan = 'pro';
  select case when count(distinct currency)>1 then null else coalesce(sum(amount),0) end into revenue from public.billing_transactions where status='successful';

  select coalesce(sum(r.total_tokens), 0) into total_tokens from public.ai_requests r where authoritative_outcome in ('succeeded','failed','legacy_unverified');
  select round(count(*) filter(where status='success')*100.0/nullif(count(*),0),1) into success_rate from public.ai_requests where authoritative_outcome in ('succeeded','failed','legacy_unverified');

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
    'ai_unknown', (select count(*) from public.ai_requests where authoritative_outcome='unknown'),
    'ai_simulated', (select count(*) from public.ai_requests where authoritative_outcome='simulated'),
    'ai_cost_unavailable', (select count(*) from public.ai_requests where authoritative_outcome<>'simulated' and estimated_cost is null),
    'ai_pending', (select count(*) from private.operation_reservations where model is not null and state='pending'),
    'students_count', students_count,
    'teachers_count', teachers_count,
    'countries', countries_agg,
    'universities', universities_agg,
    'departments', departments_agg
  );
end;
$$;
