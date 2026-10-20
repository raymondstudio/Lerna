-- Canonical authorization: no email, metadata or legacy admin_users fallback.
do $$ begin
  if exists(select 1 from auth.users) and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.role='owner' and not p.is_suspended and not p.is_deleted) then
    raise exception 'Owner preflight required: verify and assign an existing owner through an authorized database connection before applying this migration';
  end if;
end $$;
revoke create on schema public from public,anon,authenticated;
create or replace function public.is_active_user(user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=$1 and not p.is_suspended and not p.is_deleted)
$$;
create or replace function public.is_admin(user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_user($1) and exists(select 1 from public.user_roles r where r.user_id=$1 and r.role in ('admin','owner'))
$$;
create or replace function public.has_role_hierarchy(user_id uuid,min_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_user($1) and coalesce((select array_position(array['user','support','moderator','admin','owner'],r.role) from public.user_roles r where r.user_id=$1),0)
    >= coalesce(array_position(array['user','support','moderator','admin','owner'],$2),99)
$$;
revoke all on function public.is_active_user(uuid),public.is_admin(uuid),public.has_role_hierarchy(uuid,text) from public,anon;
grant execute on function public.is_active_user(uuid),public.is_admin(uuid),public.has_role_hierarchy(uuid,text) to authenticated,service_role;
create or replace function private.require_sensitive_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role()='service_role' then return; end if;
  if not public.is_admin(auth.uid()) then raise insufficient_privilege using message='ADMIN_REQUIRED'; end if;
  if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise insufficient_privilege using message='MFA_REQUIRED'; end if;
end $$;
revoke all on function private.require_sensitive_admin() from public,anon,authenticated;
-- Restrictive active-account policy composes with all existing owner/admin policies.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' and rowsecurity and tablename not in ('institutions','daily_stats') loop
    execute format('create policy stabilization_active_account on public.%I as restrictive for all to authenticated using ((select public.is_active_user(auth.uid()))) with check ((select public.is_active_user(auth.uid())))',t.tablename);
  end loop;
end $$;
create policy stabilization_storage_active on storage.objects as restrictive for all to authenticated
using ((select public.is_active_user(auth.uid()))) with check ((select public.is_active_user(auth.uid())));

create or replace function private.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if auth.uid() is null or auth.role()='service_role' then return new; end if;
  foreach k in array array['is_suspended','is_deleted','deleted_at','suspended_at','suspension_reason','admin_notes','role','plan','email','created_at'] loop
    if to_jsonb(new)->k is distinct from to_jsonb(old)->k then
      perform private.require_sensitive_admin();
      perform pg_advisory_xact_lock(917210);
      if (new.is_suspended or new.is_deleted) and exists(select 1 from public.user_roles where user_id=old.id and role='owner')
        and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.role='owner' and r.user_id<>old.id and not p.is_suspended and not p.is_deleted) then raise exception 'Cannot disable final active owner'; end if;
    end if;
  end loop;
  if new.id is distinct from old.id then raise insufficient_privilege; end if;
  return new;
end $$;
create trigger stabilization_protected_profile before update on public.profiles for each row execute function private.protect_profile_fields();
create or replace function private.authorize_sensitive_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor_role text;
begin
  if auth.uid() is null or auth.role()='service_role' then return coalesce(new,old); end if;
  perform private.require_sensitive_admin();
  if tg_table_name='user_roles' then
    perform pg_advisory_xact_lock(917210);
    select role into actor_role from public.user_roles where user_id=auth.uid();
    if (case when tg_op='INSERT' then false else old.role in ('admin','owner') end or case when tg_op='DELETE' then false else new.role in ('admin','owner') end) and actor_role<>'owner' then raise insufficient_privilege using message='OWNER_REQUIRED'; end if;
    if tg_op<>'INSERT' and old.role='owner' and (tg_op='DELETE' or new.role<>'owner') and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id<>old.user_id and r.role='owner' and not p.is_suspended and not p.is_deleted) then raise exception 'Cannot remove final active owner'; end if;
  end if;
  return coalesce(new,old);
end $$;
create or replace function private.audit_sensitive_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare entity jsonb;
begin
  if auth.uid() is null or auth.role()='service_role' then return coalesce(new,old); end if;
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
  entity := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform private.append_event(jsonb_build_object('user_id',auth.uid(),'event_type',case when tg_table_name='user_roles' then 'admin.role.changed' else 'admin.settings.changed' end,'category','security','outcome','succeeded','severity','warning','source','database','resource_type',tg_table_name,'resource_id',case when tg_table_name in ('user_roles','admin_users','subscriptions') then entity->>'user_id' else null end,'properties',case when tg_table_name='user_roles' then jsonb_build_object('new_role',case when tg_op='DELETE' then 'removed' else entity->>'role' end) else jsonb_build_object('setting',tg_table_name) end));
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['user_roles','admin_users','feature_flags','subscriptions'] loop
    execute format('create trigger stabilization_sensitive_mutation before update or delete on public.%I for each row execute function private.authorize_sensitive_mutation()',t);
    execute format('create trigger stabilization_sensitive_audit after insert or update or delete on public.%I for each row execute function private.audit_sensitive_mutation()',t);
  end loop;
end $$;
-- INSERT must also be guarded; signup triggers run with an empty auth.uid().
create trigger stabilization_role_insert before insert on public.user_roles for each row execute function private.authorize_sensitive_mutation();
create trigger stabilization_admin_insert before insert on public.admin_users for each row execute function private.authorize_sensitive_mutation();
create trigger stabilization_flag_insert before insert on public.feature_flags for each row execute function private.authorize_sensitive_mutation();
create or replace function private.audit_profile_security() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and (new.is_suspended is distinct from old.is_suspended or new.is_deleted is distinct from old.is_deleted) then
    perform private.append_event(jsonb_build_object('user_id',auth.uid(),'event_type','admin.settings.changed','category','security','outcome','succeeded','severity','warning','source','database','resource_type','profile','resource_id',new.id,'properties',jsonb_build_object('setting','account_status')));
  end if;
  return new;
end $$;
create trigger stabilization_profile_security_audit after update on public.profiles for each row execute function private.audit_profile_security();
revoke insert,update,delete on public.admin_users from authenticated;
create or replace function public.admin_change_role(target_user_id uuid,new_role text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor_role text; target_role text;
begin
  perform private.require_sensitive_admin();
  if new_role not in ('user','support','moderator','admin','owner') then raise exception 'Invalid role'; end if;
  -- Serialize role edits so two removals cannot remove the final owner.
  perform pg_advisory_xact_lock(917210);
  select role into actor_role from public.user_roles where user_id=auth.uid();
  select role into target_role from public.user_roles where user_id=target_user_id for update;
  if (new_role in ('admin','owner') or target_role in ('admin','owner')) and actor_role<>'owner' then raise insufficient_privilege using message='OWNER_REQUIRED'; end if;
  if target_role='owner' and new_role<>'owner' and (select count(*) from public.user_roles where role='owner')<=1 then raise exception 'Cannot remove final owner'; end if;
  insert into public.user_roles(user_id,role,updated_at) values(target_user_id,new_role,now()) on conflict(user_id) do update set role=excluded.role,updated_at=now();
  return true;
end $$;
revoke all on function public.admin_change_role(uuid,text) from public,anon;
grant execute on function public.admin_change_role(uuid,text) to authenticated;
-- Every child must belong to the same owner as its live parent, including Data API writes.
create or replace function private.validate_learning_parents() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_data jsonb := to_jsonb(new); actor uuid := (to_jsonb(new)->>'user_id')::uuid; parent uuid;
begin
  parent := nullif(row_data->>'session_id','')::uuid;
  if parent is not null and not exists(select 1 from public.study_sessions where id=parent and user_id=actor) then raise insufficient_privilege using message='Foreign session'; end if;
  parent := nullif(row_data->>'course_id','')::uuid;
  if parent is not null and not exists(select 1 from public.courses where id=parent and user_id=actor) then raise insufficient_privilege using message='Foreign course'; end if;
  parent := nullif(row_data->>'material_id','')::uuid;
  if parent is not null and not exists(select 1 from public.uploaded_materials where id=parent and user_id=actor and deleted_at is null) then raise insufficient_privilege using message='Foreign material'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['study_sessions','study_messages','uploaded_materials','notes','quizzes'] loop
    execute format('create trigger stabilization_parent_owner before insert or update on public.%I for each row execute function private.validate_learning_parents()',t);
  end loop;
end $$;
create or replace function private.validate_storage_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare path text[];
begin
  if new.bucket_id<>'uploaded-materials' then return new; end if;
  path := string_to_array(new.name,'/');
  if path[1] is null or path[2] is null or not exists(select 1 from public.study_sessions where id::text=path[2] and user_id::text=path[1] and public.is_active_user(user_id)) then raise insufficient_privilege using message='Invalid storage parent'; end if;
  if auth.role()<>'service_role' and path[1]<>auth.uid()::text then raise insufficient_privilege; end if;
  return new;
end $$;
create trigger stabilization_storage_parent before insert or update on storage.objects for each row execute function private.validate_storage_parent();
-- Existing usage mutator is service-only; reservations replace ordinary-client increments.
revoke execute on function public.increment_subscription_usage(uuid,date,text,integer) from public,anon,authenticated;
grant execute on function public.increment_subscription_usage(uuid,date,text,integer) to service_role;
-- Lock search paths for historical SECURITY DEFINER routines without changing their contracts.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
    if f.proname not in ('is_active_user','is_admin','has_role_hierarchy','append_activity_event','consume_activity_ingest_budget','cleanup_activity_events','admin_change_role') then execute format('alter function %s set search_path = public, pg_temp',f.signature); end if;
    execute format('revoke execute on function %s from public, anon',f.signature);
    if f.proname in ('is_active_user','is_admin','has_role_hierarchy','get_admin_users','get_admin_user_details','get_admin_stats','get_historical_analytics','get_admin_business_intelligence','get_institution_analytics','check_system_health','complete_onboarding','search_institutions','admin_toggle_suspension','admin_toggle_soft_delete','admin_delete_user','admin_assign_plan','admin_change_role') then execute format('grant execute on function %s to authenticated',f.signature); end if;
    if f.proname in ('add_admin','remove_admin','recalculate_daily_stats') then execute format('revoke execute on function %s from authenticated',f.signature); end if;
  end loop;
end $$;
