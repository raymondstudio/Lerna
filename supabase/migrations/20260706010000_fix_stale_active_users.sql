-- Migration: Fix Stale Active Users Demographics (2026-07-06)

-- Sync existing profile created_at and last_active times with their true auth database timestamps
update public.profiles p
set created_at = u.created_at,
    last_active = coalesce(u.last_sign_in_at, u.created_at)
from auth.users u
where p.id = u.id;
