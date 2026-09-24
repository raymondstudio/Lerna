-- Production-safe onboarding reliability and profile canonicalization.
-- This migration is additive: it preserves all existing profile and preference data.

alter table public.profiles
  add column if not exists company text;

-- Preserve goals collected by the normalized preferences table when the unified
-- profile column has not received a value yet.
update public.profiles as p
set study_goals = up.learning_goals
from public.user_preferences as up
where p.id = up.id
  and coalesce(cardinality(p.study_goals), 0) = 0
  and coalesce(cardinality(up.learning_goals), 0) > 0;

-- Correct the legacy default for users whose explicit account type proves that
-- they are not students. Null account types remain untouched.
update public.profiles
set is_student = lower(account_type) = 'student'
where account_type is not null
  and btrim(account_type) <> ''
  and is_student is distinct from (lower(account_type) = 'student');

create or replace function public.complete_onboarding(
  target_user_id uuid,
  profile_data jsonb,
  pref_data jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  profile_role text;
  goal_texts text[] := array[]::text[];
  interest_texts text[] := array[]::text[];
  affected_rows integer;
begin
  if caller_id is null or caller_id <> target_user_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  profile_role := lower(btrim(coalesce(profile_data->>'account_type', '')));

  if profile_role not in ('student', 'teacher', 'professional', 'researcher', 'other') then
    raise exception 'A valid account type is required.' using errcode = '22023';
  end if;

  if jsonb_typeof(profile_data->'study_goals') = 'array' then
    select coalesce(array_agg(goal order by ordinal), array[]::text[])
      into goal_texts
    from (
      select distinct on (btrim(value)) btrim(value) as goal, ordinality as ordinal
      from jsonb_array_elements_text(profile_data->'study_goals') with ordinality
      where btrim(value) <> ''
      order by btrim(value), ordinality
    ) as normalized_goals;
  elsif jsonb_typeof(pref_data->'learning_goals') = 'array' then
    select coalesce(array_agg(goal order by ordinal), array[]::text[])
      into goal_texts
    from (
      select distinct on (btrim(value)) btrim(value) as goal, ordinality as ordinal
      from jsonb_array_elements_text(pref_data->'learning_goals') with ordinality
      where btrim(value) <> ''
      order by btrim(value), ordinality
    ) as normalized_goals;
  end if;

  if jsonb_typeof(profile_data->'interests') = 'array' then
    select coalesce(array_agg(interest order by ordinal), array[]::text[])
      into interest_texts
    from (
      select distinct on (btrim(value)) btrim(value) as interest, ordinality as ordinal
      from jsonb_array_elements_text(profile_data->'interests') with ordinality
      where btrim(value) <> ''
      order by btrim(value), ordinality
    ) as normalized_interests;
  end if;

  update public.profiles
  set
    account_type = profile_data->>'account_type',
    institution = coalesce(nullif(btrim(profile_data->>'institution'), ''), institution),
    institution_id = coalesce(nullif(profile_data->>'institution_id', '')::uuid, institution_id),
    institution_type = coalesce(nullif(btrim(profile_data->>'institution_type'), ''), institution_type),
    faculty = coalesce(nullif(btrim(profile_data->>'faculty'), ''), faculty),
    department = coalesce(nullif(btrim(profile_data->>'department'), ''), department),
    study_level = coalesce(nullif(btrim(profile_data->>'study_level'), ''), study_level),
    company = coalesce(nullif(btrim(profile_data->>'company'), ''), company),
    occupation = coalesce(nullif(btrim(profile_data->>'occupation'), ''), occupation),
    industry = coalesce(nullif(btrim(profile_data->>'industry'), ''), industry),
    field = coalesce(nullif(btrim(profile_data->>'field'), ''), field),
    study_goals = goal_texts,
    interests = interest_texts,
    is_student = profile_role = 'student',
    onboarding_completed = true,
    updated_at = now()
  where id = target_user_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Profile record not found.' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.complete_onboarding(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.complete_onboarding(uuid, jsonb, jsonb) to authenticated;

-- Profiles is the application source of truth. Keep the older normalized
-- preference rows as a one-way compatibility mirror for legacy admin/reporting
-- code without allowing those rows to diverge from profile edits.
create or replace function public.sync_profile_compatibility_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_preferences (
    id,
    teaching_style,
    difficulty,
    preferred_language,
    preferred_quiz_format,
    flashcard_preference,
    response_length,
    voice_preference,
    learning_goals,
    updated_at
  )
  values (
    new.id,
    new.teaching_style,
    new.difficulty,
    new.preferred_language,
    new.preferred_quiz_format,
    new.flashcard_preference,
    new.response_length,
    new.voice_preference,
    new.study_goals,
    now()
  )
  on conflict (id) do update
  set
    teaching_style = excluded.teaching_style,
    difficulty = excluded.difficulty,
    preferred_language = excluded.preferred_language,
    preferred_quiz_format = excluded.preferred_quiz_format,
    flashcard_preference = excluded.flashcard_preference,
    response_length = excluded.response_length,
    voice_preference = excluded.voice_preference,
    learning_goals = excluded.learning_goals,
    updated_at = now();

  insert into public.notification_preferences (
    id,
    marketing,
    security_alerts,
    study_reminders,
    updated_at
  )
  values (
    new.id,
    new.marketing_updates_enabled,
    new.security_alerts_enabled,
    new.study_reminder_enabled,
    now()
  )
  on conflict (id) do update
  set
    marketing = excluded.marketing,
    security_alerts = excluded.security_alerts,
    study_reminders = excluded.study_reminders,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_profile_compatibility_rows() from public, anon, authenticated;

drop trigger if exists profiles_sync_compatibility_rows on public.profiles;
create trigger profiles_sync_compatibility_rows
  after insert or update of
    teaching_style,
    difficulty,
    preferred_language,
    preferred_quiz_format,
    flashcard_preference,
    response_length,
    voice_preference,
    study_goals,
    marketing_updates_enabled,
    security_alerts_enabled,
    study_reminder_enabled
  on public.profiles
  for each row
  execute function public.sync_profile_compatibility_rows();

-- Harden the auth trigger added by earlier migrations. It remains backward
-- compatible and now has a pinned search_path and no direct API execution.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_first text;
  user_last text;
  user_avatar text;
  ref_code text;
  inst_code text;
  tos_time timestamptz;
  priv_time timestamptz;
begin
  user_first := coalesce(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1), '');
  user_last := coalesce(new.raw_user_meta_data->>'last_name', substring(new.raw_user_meta_data->>'full_name' from '^[^\s]+\s+(.*)$'), '');
  user_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', '');
  ref_code := new.raw_user_meta_data->>'referral_code_used';
  inst_code := new.raw_user_meta_data->>'institution_invite_code_used';
  tos_time := nullif(new.raw_user_meta_data->>'tos_accepted_at', '')::timestamptz;
  priv_time := nullif(new.raw_user_meta_data->>'privacy_accepted_at', '')::timestamptz;

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    avatar_url,
    onboarding_completed,
    is_deleted,
    tos_accepted_at,
    privacy_accepted_at,
    referral_code_used,
    institution_invite_code_used
  )
  values (
    new.id,
    new.email,
    user_first,
    user_last,
    user_avatar,
    false,
    false,
    tos_time,
    priv_time,
    ref_code,
    inst_code
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (id) values (new.id) on conflict (id) do nothing;
  insert into public.notification_preferences (id) values (new.id) on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan) values (new.id, 'free') on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Keep own-profile policies explicit and efficient. UPDATE requires SELECT and
-- protects both the existing and resulting row ownership.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Course mention search is scoped by user through RLS; trigram indexes keep
-- partial code/title filtering responsive for large course collections.
create index if not exists courses_code_search_trgm_idx
  on public.courses using gin (lower(code) gin_trgm_ops);

create index if not exists courses_title_search_trgm_idx
  on public.courses using gin (lower(title) gin_trgm_ops);
