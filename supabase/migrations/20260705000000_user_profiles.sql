-- Migration: SaaS User Profiles & Onboarding (2026-07-05)

-- 1. Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  avatar_url text,
  account_type text,
  institution text,
  institution_type text,
  department text,
  study_level text,
  study_goals text[],
  country text,
  plan text not null default 'free',
  onboarding_completed boolean not null default false,
  
  -- Preferences
  teaching_style text not null default 'Intermediate',
  preferred_question_type text not null default 'Mixed',
  daily_goal_minutes integer not null default 15,
  preferred_theme text not null default 'dark',
  study_reminder_enabled boolean not null default true,
  
  -- Statistics
  learning_streak integer not null default 0,
  questions_asked_count integer not null default 0,
  docs_uploaded_count integer not null default 0,
  sessions_completed_count integer not null default 0,
  hours_studied numeric(10,2) not null default 0.00,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Create RLS policies
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_admin(auth.uid()));

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- 2. Trigger to automatically create profile for new auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    avatar_url, 
    plan, 
    onboarding_completed
  )
  values (
    new.id,
    new.email,
    coalesce(split_part(new.raw_user_meta_data->>'full_name', ' ', 1), ''),
    coalesce(substring(new.raw_user_meta_data->>'full_name' from '^[^\s]+\s+(.*)$'), ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'free',
    false
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Backfill existing users in auth.users
insert into public.profiles (
  id, 
  email, 
  first_name, 
  last_name, 
  avatar_url, 
  plan, 
  onboarding_completed
)
select 
  u.id, 
  u.email,
  coalesce(split_part(u.raw_user_meta_data->>'full_name', ' ', 1), ''),
  coalesce(substring(u.raw_user_meta_data->>'full_name' from '^[^\s]+\s+(.*)$'), ''),
  coalesce(u.raw_user_meta_data->>'avatar_url', ''),
  'free',
  false
from auth.users u
on conflict (id) do nothing;
