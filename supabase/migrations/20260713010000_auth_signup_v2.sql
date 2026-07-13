-- Migration: Auth & Signup Experience v2 (2026-07-13)

-- 1. Alter profiles table to add terms acceptance and optional referral/invite code fields
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_code_used text,
  ADD COLUMN IF NOT EXISTS institution_invite_code_used text;

-- 2. Update the handle_new_user trigger function to map raw user metadata to these fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_first text;
  user_last text;
  user_avatar text;
  ref_code text;
  inst_code text;
  tos_time timestamptz;
  priv_time timestamptz;
BEGIN
  -- Extract names
  user_first := COALESCE(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1), '');
  user_last := COALESCE(new.raw_user_meta_data->>'last_name', substring(new.raw_user_meta_data->>'full_name' from '^[^\s]+\s+(.*)$'), '');
  user_avatar := COALESCE(new.raw_user_meta_data->>'avatar_url', '');
  
  -- Extract referrals and invite codes
  ref_code := new.raw_user_meta_data->>'referral_code_used';
  inst_code := new.raw_user_meta_data->>'institution_invite_code_used';
  
  -- Extract and parse dates
  IF (new.raw_user_meta_data->>'tos_accepted_at') IS NOT NULL THEN
    tos_time := (new.raw_user_meta_data->>'tos_accepted_at')::timestamptz;
  ELSE
    tos_time := NULL;
  END IF;

  IF (new.raw_user_meta_data->>'privacy_accepted_at') IS NOT NULL THEN
    priv_time := (new.raw_user_meta_data->>'privacy_accepted_at')::timestamptz;
  ELSE
    priv_time := NULL;
  END IF;

  -- 1. Create identity profile
  INSERT INTO public.profiles (
    id, email, first_name, last_name, avatar_url, onboarding_completed, is_deleted,
    tos_accepted_at, privacy_accepted_at, referral_code_used, institution_invite_code_used
  )
  VALUES (
    new.id, new.email, user_first, user_last, user_avatar, false, false,
    tos_time, priv_time, ref_code, inst_code
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create preferences row
  INSERT INTO public.user_preferences (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;

  -- 3. Create notifications row
  INSERT INTO public.notification_preferences (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;

  -- 4. Create subscriptions row
  INSERT INTO public.subscriptions (user_id, plan) VALUES (new.id, 'free') ON CONFLICT (user_id) DO NOTHING;

  -- 5. Create default role row
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
