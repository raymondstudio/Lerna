-- Synthetic provider scaffolding ONLY. Application tables, RLS, functions and
-- triggers come from the actual ordered repository migrations, never replicas.
-- SQL role/JWT settings below are fixtures, not real Supabase Auth or Storage.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create table auth.users (
  id uuid primary key, email text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}', raw_app_meta_data jsonb not null default '{}',
  last_sign_in_at timestamptz, email_confirmed_at timestamptz, confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'sub','')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role',''),'anon')
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
grant usage on schema auth,storage,extensions,public to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,owner uuid,metadata jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table storage.objects enable row level security;
grant select on storage.buckets to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
grant all on all tables in schema storage to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;
create publication supabase_realtime;
