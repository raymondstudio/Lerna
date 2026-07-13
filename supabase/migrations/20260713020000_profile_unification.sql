-- Migration: Profile Unification and Backfill (2026-07-13)

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists faculty text,
  add column if not exists occupation text,
  add column if not exists industry text,
  add column if not exists field text,
  add column if not exists bio text,
  add column if not exists timezone text,
  add column if not exists learning_preferences jsonb not null default '{}'::jsonb,
  add column if not exists study_goals text[] not null default '{}'::text[],
  add column if not exists favorite_subjects text[] not null default '{}'::text[],
  add column if not exists interests text[] not null default '{}'::text[],
  add column if not exists accessibility_preferences jsonb not null default '{}'::jsonb,
  add column if not exists teaching_style text not null default 'Intermediate',
  add column if not exists difficulty text not null default 'Medium',
  add column if not exists preferred_question_type text not null default 'Mixed',
  add column if not exists preferred_quiz_format text not null default 'Mixed',
  add column if not exists flashcard_preference text not null default 'Standard',
  add column if not exists preferred_language text not null default 'English',
  add column if not exists response_length text not null default 'Medium',
  add column if not exists voice_preference text not null default 'Default',
  add column if not exists daily_goal_minutes integer not null default 15,
  add column if not exists preferred_theme text not null default 'dark',
  add column if not exists study_reminder_enabled boolean not null default true,
  add column if not exists marketing_updates_enabled boolean not null default true,
  add column if not exists security_alerts_enabled boolean not null default true;

update public.profiles p
set
  teaching_style = coalesce(up.teaching_style, p.teaching_style),
  difficulty = coalesce(up.difficulty, p.difficulty),
  preferred_language = coalesce(up.preferred_language, p.preferred_language),
  preferred_quiz_format = coalesce(up.preferred_quiz_format, p.preferred_quiz_format),
  preferred_question_type = coalesce(up.preferred_quiz_format, p.preferred_question_type),
  flashcard_preference = coalesce(up.flashcard_preference, p.flashcard_preference),
  response_length = coalesce(up.response_length, p.response_length),
  voice_preference = coalesce(up.voice_preference, p.voice_preference),
  study_goals = coalesce(up.learning_goals, p.study_goals),
  study_reminder_enabled = coalesce(np.study_reminders, p.study_reminder_enabled),
  marketing_updates_enabled = coalesce(np.marketing, p.marketing_updates_enabled),
  security_alerts_enabled = coalesce(np.security_alerts, p.security_alerts_enabled)
from public.user_preferences up
left join public.notification_preferences np on np.id = up.id
where p.id = up.id;

update public.profiles
set display_name = nullif(trim(concat_ws(' ', first_name, last_name)), '')
where display_name is null or display_name = '';

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
  profile_role text;
begin
  if auth.uid() <> target_user_id and not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  profile_role := lower(coalesce(profile_data->>'account_type', 'student'));

  if (profile_data->>'account_type') is null or (profile_data->>'account_type') = '' then
    raise exception 'Account type is a required field.';
  end if;

  if profile_role in ('student', 'teacher', 'professional') then
    if coalesce(profile_data->>'institution', '') = '' and profile_role <> 'professional' then
      raise exception 'Please specify your institution.';
    end if;
  end if;

  if profile_role = 'student' then
    if coalesce(profile_data->>'department', '') = '' then
      raise exception 'Please enter your department or study course.';
    end if;
    if coalesce(profile_data->>'study_level', '') = '' then
      raise exception 'Please select your current academic study level.';
    end if;
  end if;

  update public.profiles
  set
    account_type = profile_data->>'account_type',
    institution = nullif(profile_data->>'institution', ''),
    institution_id = nullif(profile_data->>'institution_id', '')::uuid,
    institution_type = nullif(profile_data->>'institution_type', ''),
    faculty = nullif(profile_data->>'faculty', ''),
    department = nullif(coalesce(profile_data->>'department', profile_data->>'custom_department'), ''),
    study_level = nullif(profile_data->>'study_level', ''),
    occupation = nullif(profile_data->>'occupation', ''),
    industry = nullif(profile_data->>'industry', ''),
    field = nullif(profile_data->>'field', ''),
    bio = nullif(profile_data->>'bio', ''),
    onboarding_completed = coalesce((profile_data->>'onboarding_completed')::boolean, true),
    updated_at = now()
  where id = target_user_id;

  goal_texts := array[]::text[];
  if pref_data ? 'learning_goals' and jsonb_typeof(pref_data->'learning_goals') = 'array' then
    select array_agg(val)::text[] into goal_texts
    from jsonb_array_elements_text(pref_data->'learning_goals') val;
  end if;

  insert into public.user_preferences (id, learning_goals, updated_at)
  values (target_user_id, coalesce(goal_texts, array[]::text[]), now())
  on conflict (id) do update
  set learning_goals = excluded.learning_goals, updated_at = now();

  return true;
exception
  when others then
    raise exception '%', SQLERRM;
end;
$$;
