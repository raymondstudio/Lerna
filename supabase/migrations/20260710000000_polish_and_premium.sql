-- Migration: Support Replies, Plan Constraints, Atomic Onboarding & Admin Plan Assignment (2026-07-10)

-- 1. Create support_ticket_replies table
create table if not exists public.support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.support_tickets(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS) on replies
alter table public.support_ticket_replies enable row level security;

-- Drop existing policies if any
drop policy if exists "replies_select_own" on public.support_ticket_replies;
drop policy if exists "replies_insert_own" on public.support_ticket_replies;

-- Define RLS policies for support ticket replies
create policy "replies_select_own" on public.support_ticket_replies
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "replies_insert_own" on public.support_ticket_replies
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Grant privileges for support replies
grant select, insert on table public.support_ticket_replies to authenticated;
grant all on table public.support_ticket_replies to service_role;

-- 2. Alter check constraints on plans to allow 'student', 'pro', 'team'
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check 
  check (plan in ('free', 'student', 'pro', 'team', 'premium', 'enterprise'));

-- 3. Alter broadcasts table to add draft/publishing and expiration metadata
alter table public.broadcasts 
  add column if not exists status text not null default 'published' check (status in ('draft', 'published', 'scheduled')),
  add column if not exists scheduled_for timestamptz,
  add column if not exists expires_at timestamptz;

-- 4. RPC: Atomic Onboarding Completion
create or replace function public.complete_onboarding(
  target_user_id uuid,
  profile_data jsonb,
  pref_data jsonb
)
returns boolean
security definer
language plpgsql
as $$
declare
  goal_texts text[];
  g text;
begin
  -- Authenticate caller or check if admin
  if auth.uid() <> target_user_id and not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  -- Validate inputs
  if (profile_data->>'account_type') is null or (profile_data->>'account_type') = '' then
    raise exception 'Account type is a required field.';
  end if;

  if (profile_data->>'institution') is null or (profile_data->>'institution') = '' then
    raise exception 'Please specify your institution.';
  end if;

  if (profile_data->>'department') is null or (profile_data->>'department') = '' then
    raise exception 'Please enter your department or study course.';
  end if;

  if (profile_data->>'study_level') is null or (profile_data->>'study_level') = '' then
    raise exception 'Please select your current academic study level.';
  end if;

  -- Update profiles table
  update public.profiles
  set 
    account_type = (profile_data->>'account_type'),
    institution = (profile_data->>'institution'),
    institution_id = nullif(profile_data->>'institution_id', '')::uuid,
    institution_type = (profile_data->>'institution_type'),
    department = (profile_data->>'department'),
    study_level = (profile_data->>'study_level'),
    onboarding_completed = coalesce((profile_data->>'onboarding_completed')::boolean, true),
    updated_at = now()
  where id = target_user_id;

  -- Convert JSONB array to text[] safely
  goal_texts := array[]::text[];
  if pref_data ? 'learning_goals' and jsonb_typeof(pref_data->'learning_goals') = 'array' then
    select array_agg(val)::text[] into goal_texts
    from jsonb_array_elements_text(pref_data->'learning_goals') val;
  end if;

  -- Upsert preferences
  insert into public.user_preferences (id, learning_goals, updated_at)
  values (
    target_user_id,
    coalesce(goal_texts, array[]::text[]),
    now()
  )
  on conflict (id) do update
  set 
    learning_goals = EXCLUDED.learning_goals,
    updated_at = now();

  return true;
exception
  when others then
    raise exception '%', SQLERRM;
end;
$$;

-- 5. RPC: Administrative Manual Plan Assignment
create or replace function public.admin_assign_plan(
  target_user_id uuid,
  new_plan text,
  plan_status text default 'active',
  is_promo boolean default false
)
returns boolean
security definer
language plpgsql
as $$
declare
  period_end timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  -- Calculate periods
  if is_promo then
    period_end := now() + interval '30 days';
  else
    period_end := now() + interval '1 year';
  end if;

  -- 2. Upsert subscriptions entry
  insert into public.subscriptions (
    user_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    payment_provider,
    updated_at
  )
  values (
    target_user_id,
    new_plan,
    plan_status,
    now(),
    period_end,
    case when is_promo then 'promo' else 'manual' end,
    now()
  )
  on conflict (user_id) do update
  set 
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    payment_provider = EXCLUDED.payment_provider,
    updated_at = now();

  -- 3. Log action to audit logs
  insert into public.audit_logs (user_id, action, details)
  values (
    auth.uid(),
    'plan_assigned',
    jsonb_build_object(
      'target_user_id', target_user_id, 
      'new_plan', new_plan, 
      'status', plan_status, 
      'is_promo', is_promo
    )
  );

  return true;
end;
$$;
