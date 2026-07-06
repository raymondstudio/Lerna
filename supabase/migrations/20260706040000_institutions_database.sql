-- Migration: Searchable Education Database (2026-07-06)

-- 1. Enable pg_trgm extension for fuzzy similarity searching
create extension if not exists pg_trgm;

-- 2. Create institutions table
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  country text not null default 'Nigeria',
  state text,
  city text,
  institution_type text not null check (institution_type in ('University', 'Polytechnic', 'College of Education', 'Secondary School', 'Primary School', 'Other')),
  website text,
  aliases text[],
  is_verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Add institution_id reference to profiles table
alter table public.profiles 
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;

-- 4. Create an immutable array-to-string wrapper function to allow indexing array fields
create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text as $$
begin
  return array_to_string(arr, sep);
end;
$$ language plpgsql immutable;

-- Create GIN Trigram index for fast fuzzy searching
create index if not exists idx_institutions_search_trgm on public.institutions 
  using gin ((name || ' ' || coalesce(short_name, '') || ' ' || coalesce(public.immutable_array_to_string(aliases, ' '), '')) gin_trgm_ops);

-- 5. Create SQL function for smart school searching
create or replace function public.search_institutions(
  search_query text, 
  filter_type text default null, 
  limit_val int default 20
)
returns table (
  id uuid,
  name text,
  short_name text,
  country text,
  state text,
  city text,
  institution_type text,
  website text,
  aliases text[],
  is_verified boolean,
  similarity_score real
) as $$
begin
  return query
  select 
    inst.id,
    inst.name,
    inst.short_name,
    inst.country,
    inst.state,
    inst.city,
    inst.institution_type,
    inst.website,
    inst.aliases,
    inst.is_verified,
    similarity(inst.name || ' ' || coalesce(inst.short_name, '') || ' ' || coalesce(array_to_string(inst.aliases, ' '), ''), search_query) as similarity_score
  from public.institutions inst
  where 
    (filter_type is null or filter_type = '' or inst.institution_type = filter_type)
    and (
      inst.name ilike '%' || search_query || '%'
      or inst.short_name ilike '%' || search_query || '%'
      or exists (select 1 from unnest(inst.aliases) a where a ilike '%' || search_query || '%')
      or similarity(inst.name, search_query) > 0.15
      or similarity(coalesce(inst.short_name, ''), search_query) > 0.15
    )
  order by 
    (case when lower(inst.short_name) = lower(search_query) then 0 else 1 end) asc,
    (case when inst.short_name ilike search_query || '%' then 0 else 1 end) asc,
    similarity_score desc,
    inst.name asc
  limit limit_val;
end;
$$ language plpgsql stable security invoker;

-- 6. Configure Row Level Security (RLS)
alter table public.institutions enable row level security;

drop policy if exists "institutions_select_all" on public.institutions;
create policy "institutions_select_all" on public.institutions
  for select to authenticated using (true);

drop policy if exists "institutions_insert_custom" on public.institutions;
create policy "institutions_insert_custom" on public.institutions
  for insert to authenticated 
  with check (is_verified = false);

drop policy if exists "institutions_admin_all" on public.institutions;
create policy "institutions_admin_all" on public.institutions
  for all to authenticated using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 7. Create SQL function for institution analytics
create or replace function public.get_institution_analytics()
returns json as $$
declare
  by_university json;
  by_secondary json;
  by_state json;
  by_country json;
  leaderboard json;
begin
  -- Top Universities
  select coalesce(json_agg(t), '[]'::json) into by_university
  from (
    select 
      coalesce(inst.name, p.institution) as name, 
      count(p.id) as user_count
    from public.profiles p
    left join public.institutions inst on p.institution_id = inst.id
    where p.is_deleted = false and (p.institution_id is not null or p.institution is not null)
      and coalesce(inst.institution_type, p.institution_type) = 'University'
    group by 1
    order by user_count desc
    limit 10
  ) t;

  -- Top Secondary Schools
  select coalesce(json_agg(t), '[]'::json) into by_secondary
  from (
    select 
      coalesce(inst.name, p.institution) as name, 
      count(p.id) as user_count
    from public.profiles p
    left join public.institutions inst on p.institution_id = inst.id
    where p.is_deleted = false and (p.institution_id is not null or p.institution is not null)
      and coalesce(inst.institution_type, p.institution_type) = 'Secondary School'
    group by 1
    order by user_count desc
    limit 10
  ) t;

  -- Users by State
  select coalesce(json_agg(t), '[]'::json) into by_state
  from (
    select 
      coalesce(inst.state, 'Unknown') as state, 
      count(p.id) as user_count
    from public.profiles p
    join public.institutions inst on p.institution_id = inst.id
    where p.is_deleted = false
    group by 1
    order by user_count desc
    limit 15
  ) t;

  -- Users by Country
  select coalesce(json_agg(t), '[]'::json) into by_country
  from (
    select 
      coalesce(inst.country, p.country, 'Unknown') as country, 
      count(p.id) as user_count
    from public.profiles p
    left join public.institutions inst on p.institution_id = inst.id
    where p.is_deleted = false and (p.institution_id is not null or p.institution is not null)
    group by 1
    order by user_count desc
    limit 10
  ) t;

  -- General leaderboard
  select coalesce(json_agg(t), '[]'::json) into leaderboard
  from (
    select 
      coalesce(inst.name, p.institution) as name, 
      coalesce(inst.institution_type, p.institution_type, 'Other') as institution_type,
      count(p.id) as user_count
    from public.profiles p
    left join public.institutions inst on p.institution_id = inst.id
    where p.is_deleted = false and (p.institution_id is not null or p.institution is not null)
    group by 1, 2
    order by user_count desc
    limit 20
  ) t;

  return json_build_object(
    'byUniversity', by_university,
    'bySecondary', by_secondary,
    'byState', by_state,
    'byCountry', by_country,
    'leaderboard', leaderboard
  );
end;
$$ language plpgsql stable security invoker;

-- 8. Grant access rights
grant select, insert on table public.institutions to authenticated;
grant all on table public.institutions to service_role;
