-- Close direct legacy producers; v0 data remains available as unverified history.
revoke insert,update,delete on public.ai_requests,public.page_views,public.analytics_events,public.feature_usage,public.performance_metrics,public.user_attribution from anon,authenticated;
create policy stabilization_reply_sender on public.support_ticket_replies as restrictive for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=(select auth.uid()) or public.is_admin((select auth.uid())))));
create or replace function private.touch_ticket_from_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin update public.support_tickets set last_reply=new.created_at,updated_at=clock_timestamp() where id=new.ticket_id; return new; end $$;
create trigger stabilization_ticket_reply after insert on public.support_ticket_replies for each row execute function private.touch_ticket_from_reply();
-- Published announcements stay readable to the intended learners through the Data API too.
drop policy if exists broadcasts_select_all on public.broadcasts;
create policy stabilization_broadcast_read on public.broadcasts for select to authenticated using (
  public.is_admin((select auth.uid())) or (status='published' and (scheduled_for is null or scheduled_for<=now()) and (expires_at is null or expires_at>now())
  and exists(select 1 from public.profiles p left join public.subscriptions s on s.user_id=p.id where p.id=(select auth.uid())
    and (coalesce(nullif(lower(btrim(target_audience)),''),'all')='all' or (lower(target_audience)='students' and lower(p.account_type)='student') or (lower(target_audience)='teachers' and lower(p.account_type)='teacher') or lower(target_audience)=lower(coalesce(s.plan,'free')))
    and (coalesce(btrim(target_institution),'')='' or lower(btrim(p.institution))=lower(btrim(target_institution)))
    and (coalesce(btrim(target_department),'')='' or lower(btrim(p.department))=lower(btrim(target_department))))
));
-- Historical malformed child links must not become visible simply because a child user_id matches.
create policy stabilization_session_course on public.study_sessions as restrictive for all to authenticated using (course_id is null or exists(select 1 from public.courses c where c.id=course_id and c.user_id=(select auth.uid()))) with check (course_id is null or exists(select 1 from public.courses c where c.id=course_id and c.user_id=(select auth.uid())));
create policy stabilization_message_parent on public.study_messages as restrictive for all to authenticated using (exists(select 1 from public.study_sessions s where s.id=session_id and s.user_id=(select auth.uid()))) with check (exists(select 1 from public.study_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
create policy stabilization_note_parent on public.notes as restrictive for select to authenticated using (exists(select 1 from public.study_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
create policy stabilization_material_parent on public.uploaded_materials as restrictive for select to authenticated using ((session_id is null or exists(select 1 from public.study_sessions s where s.id=session_id and s.user_id=(select auth.uid()))) and (course_id is null or exists(select 1 from public.courses c where c.id=course_id and c.user_id=(select auth.uid()))));
create policy stabilization_quiz_parent on public.quizzes as restrictive for all to authenticated using ((course_id is null or exists(select 1 from public.courses c where c.id=course_id and c.user_id=(select auth.uid()))) and (material_id is null or exists(select 1 from public.uploaded_materials m where m.id=material_id and m.user_id=(select auth.uid())))) with check ((course_id is null or exists(select 1 from public.courses c where c.id=course_id and c.user_id=(select auth.uid()))) and (material_id is null or exists(select 1 from public.uploaded_materials m where m.id=material_id and m.user_id=(select auth.uid()))));

create trigger stabilization_subscription_insert before insert on public.subscriptions for each row execute function private.authorize_sensitive_mutation();
create trigger stabilization_coupon_guard before insert or update or delete on public.coupon_codes for each row execute function private.authorize_sensitive_mutation();
create trigger stabilization_coupon_audit after insert or update or delete on public.coupon_codes for each row execute function private.audit_sensitive_mutation();
create trigger stabilization_usage_guard before insert or update or delete on public.subscription_usage for each row execute function private.authorize_sensitive_mutation();
create trigger stabilization_usage_audit after insert or update or delete on public.subscription_usage for each row execute function private.audit_sensitive_mutation();
create or replace function private.audit_staff_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin(auth.uid()) then
    if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
    perform private.append_event(jsonb_build_object('user_id',auth.uid(),'event_type','admin.settings.changed','category','admin','outcome','succeeded','source','database','resource_type',tg_table_name,'properties',jsonb_build_object('setting',tg_table_name)));
  end if;
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['support_tickets','support_ticket_replies','feedback','broadcasts','institutions'] loop execute format('create trigger stabilization_staff_audit after insert or update or delete on public.%I for each row execute function private.audit_staff_mutation()',t); end loop;
end $$;
create or replace function private.protect_institution_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.role()='service_role' then return coalesce(new,old); end if;
  if tg_op='DELETE' or to_jsonb(new)->'is_verified' is distinct from to_jsonb(old)->'is_verified' or to_jsonb(new)->'verified' is distinct from to_jsonb(old)->'verified' or to_jsonb(new)->'verification_status' is distinct from to_jsonb(old)->'verification_status' then perform private.require_sensitive_admin(); end if;
  return coalesce(new,old);
end $$;
-- Review state names differ across historical institution versions; JSON field checks preserve compatibility.
create trigger stabilization_institution_guard before update or delete on public.institutions for each row execute function private.protect_institution_review();

create or replace function public.lease_material_cleanup_jobs(p_limit int default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 20 then raise exception 'Invalid cleanup limit'; end if;
  with due as (select material_id from private.material_cleanup_jobs where next_attempt_at<=now() order by next_attempt_at,material_id limit p_limit for update skip locked), leased as (
    update private.material_cleanup_jobs j set attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' from due d where j.material_id=d.material_id returning j.*)
  select coalesce(jsonb_agg(to_jsonb(leased)),'[]') into result from leased; return result;
end $$;
create or replace function public.fail_material_cleanup(p_material_id uuid,p_expected_revision bigint) returns void
language sql security definer set search_path = '' as $$
  update private.material_cleanup_jobs set next_attempt_at=now()+make_interval(secs=>least(86400,60*power(2,least(attempts,10)))::int),last_error_code='CLEANUP_DEPENDENCY_UNAVAILABLE' where material_id=p_material_id and revision=p_expected_revision
$$;
create or replace function public.material_cleanup_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('pending',count(*),'failed',count(*) filter(where last_error_code is not null),'oldest',min(created_at)) from private.material_cleanup_jobs
$$;
revoke all on function public.lease_material_cleanup_jobs(int),public.fail_material_cleanup(uuid,bigint),public.material_cleanup_status() from public,anon,authenticated;
grant execute on function public.lease_material_cleanup_jobs(int),public.fail_material_cleanup(uuid,bigint),public.material_cleanup_status() to service_role;
create or replace function private.pseudonymize_deleted_actor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.events set user_id=case when user_id=old.id then null else user_id end,
    actor_type=case when user_id=old.id and schema_version=1 then 'system' else actor_type end,
    actor_role=case when user_id=old.id then null else actor_role end,
    resource_id=case when resource_type in ('profile','user') and resource_id=old.id then null else resource_id end,
    dedup_key=null,
    properties=case when schema_version=0 then '{}'::jsonb else properties end
  where user_id=old.id or (resource_type in ('profile','user') and resource_id=old.id);
  return old;
end $$;
create trigger stabilization_pseudonymize_actor before delete on auth.users for each row execute function private.pseudonymize_deleted_actor();
