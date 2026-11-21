-- Migration: 20261121000000_my_assignments.sql
-- Description: Schema and RLS policies for My Assignments feature (assignments, messages, attachments, collections)

-- 1. Create assignments table
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  description text,
  mode text not null default 'explain' check (mode in ('answer', 'explain')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  extracted_questions jsonb not null default '[]'::jsonb,
  share_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create assignment_messages table
create table if not exists public.assignment_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. Create assignment_attachments table
create table if not exists public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  extracted_text text,
  created_at timestamptz not null default now()
);

-- 4. Create assignment_collections table
create table if not exists public.assignment_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null default 'My Assignments Collection',
  description text,
  share_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists assignments_user_id_updated_at_idx on public.assignments (user_id, updated_at desc);
create index if not exists assignments_course_id_idx on public.assignments (course_id);
create index if not exists assignments_share_token_idx on public.assignments (share_token);
create index if not exists assignment_messages_assignment_id_created_at_idx on public.assignment_messages (assignment_id, created_at asc);
create index if not exists assignment_messages_user_id_idx on public.assignment_messages (user_id);
create index if not exists assignment_attachments_assignment_id_idx on public.assignment_attachments (assignment_id);
create index if not exists assignment_attachments_user_id_idx on public.assignment_attachments (user_id);
create index if not exists assignment_collections_user_id_idx on public.assignment_collections (user_id);
create index if not exists assignment_collections_share_token_idx on public.assignment_collections (share_token);

-- Enable RLS
alter table public.assignments enable row level security;
alter table public.assignment_messages enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_collections enable row level security;

-- Grants
grant select, insert, update, delete on public.assignments to authenticated;
grant select on public.assignments to anon;
grant select, insert, update, delete on public.assignment_messages to authenticated;
grant select on public.assignment_messages to anon;
grant select, insert, update, delete on public.assignment_attachments to authenticated;
grant select on public.assignment_attachments to anon;
grant select, insert, update, delete on public.assignment_collections to authenticated;
grant select on public.assignment_collections to anon;

-- RLS Policies: assignments
create policy "assignments_select_own" on public.assignments
  for select to authenticated
  using ((select auth.uid()) = user_id or is_public = true);

create policy "assignments_select_anon_public" on public.assignments
  for select to anon
  using (is_public = true);

create policy "assignments_insert_own" on public.assignments
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "assignments_update_own" on public.assignments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "assignments_delete_own" on public.assignments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS Policies: assignment_messages
create policy "assignment_messages_select_own" on public.assignment_messages
  for select to authenticated
  using (
    (select auth.uid()) = user_id or
    exists (
      select 1 from public.assignments a
      where a.id = assignment_messages.assignment_id and a.is_public = true
    )
  );

create policy "assignment_messages_select_anon_public" on public.assignment_messages
  for select to anon
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_messages.assignment_id and a.is_public = true
    )
  );

create policy "assignment_messages_insert_own" on public.assignment_messages
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "assignment_messages_update_own" on public.assignment_messages
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "assignment_messages_delete_own" on public.assignment_messages
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS Policies: assignment_attachments
create policy "assignment_attachments_select_own" on public.assignment_attachments
  for select to authenticated
  using (
    (select auth.uid()) = user_id or
    exists (
      select 1 from public.assignments a
      where a.id = assignment_attachments.assignment_id and a.is_public = true
    )
  );

create policy "assignment_attachments_select_anon_public" on public.assignment_attachments
  for select to anon
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_attachments.assignment_id and a.is_public = true
    )
  );

create policy "assignment_attachments_insert_own" on public.assignment_attachments
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "assignment_attachments_update_own" on public.assignment_attachments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "assignment_attachments_delete_own" on public.assignment_attachments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- RLS Policies: assignment_collections
create policy "assignment_collections_select_own" on public.assignment_collections
  for select to authenticated
  using ((select auth.uid()) = user_id or is_public = true);

create policy "assignment_collections_select_anon_public" on public.assignment_collections
  for select to anon
  using (is_public = true);

create policy "assignment_collections_insert_own" on public.assignment_collections
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "assignment_collections_update_own" on public.assignment_collections
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "assignment_collections_delete_own" on public.assignment_collections
  for delete to authenticated
  using ((select auth.uid()) = user_id);
