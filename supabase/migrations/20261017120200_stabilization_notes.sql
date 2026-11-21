alter table public.study_sessions
  add column if not exists notes_revision bigint not null default 0 check (notes_revision>=0),
  add column if not exists notes_updated_at timestamptz,
  add column if not exists creation_operation_id uuid;
create unique index if not exists study_sessions_creation_receipt_idx on public.study_sessions(user_id,creation_operation_id) where creation_operation_id is not null;
create table if not exists private.note_legacy_variants (
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  note_id uuid not null, user_id uuid not null, canonical_content text, projection_content text not null,
  preserved_at timestamptz not null default now(), primary key(session_id,note_id)
);
-- Archive before reconciling; NULL alone means canonical content has never been saved.
insert into private.note_legacy_variants(session_id,note_id,user_id,canonical_content,projection_content)
select s.id,n.id,s.user_id,s.notes,n.content from public.study_sessions s join public.notes n on n.session_id=s.id and n.user_id=s.user_id
where s.notes is not null and s.notes is distinct from n.content on conflict do nothing;
update public.study_sessions s set notes=n.content,notes_updated_at=n.updated_at
from public.notes n where n.session_id=s.id and n.user_id=s.user_id and s.notes is null;
insert into public.notes(user_id,session_id,content,word_count)
select user_id,id,notes,case when btrim(notes)='' then 0 else cardinality(regexp_split_to_array(btrim(notes),'\s+')) end from public.study_sessions where notes is not null
on conflict(user_id,session_id) do update set content=excluded.content,word_count=excluded.word_count;
create table if not exists private.note_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null, session_id uuid not null references public.study_sessions(id) on delete cascade,
  expected_revision bigint not null, content_hash text not null, applied_revision bigint not null,
  created_at timestamptz not null default now(), primary key(user_id,operation_id)
);
revoke insert,update,delete on public.notes from authenticated;
-- Table-level grants otherwise override column restrictions. Notes only change via the transaction below.
revoke insert,update on public.study_sessions from authenticated;
grant insert(id,user_id,title,topic_category,last_message,course_id,status,duration_seconds,topics_covered,summary,creation_operation_id) on public.study_sessions to authenticated;
grant update(title,topic_category,last_message,course_id,status,duration_seconds,topics_covered,summary,updated_at) on public.study_sessions to authenticated;
create or replace function public.save_session_notes(p_session_id uuid,p_notes text,p_expected_revision bigint,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); saved public.study_sessions; receipt private.note_operations; fingerprint text;
begin
  if not public.is_active_user(actor) then raise insufficient_privilege using message='ACTIVE_ACCOUNT_REQUIRED'; end if;
  if p_notes is null or p_expected_revision is null or p_operation_id is null then raise sqlstate 'PT428' using message='NOTE_PRECONDITIONS_REQUIRED'; end if;
  if p_expected_revision<0 then raise sqlstate 'PT428' using message='INVALID_NOTE_REVISION'; end if;
  if octet_length(p_notes)>100000 then raise sqlstate 'PT413' using message='NOTES_TOO_LARGE'; end if;
  -- Per-actor operation lock serializes duplicate keys even when used across different sessions.
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_operation_id::text,0));
  select * into saved from public.study_sessions where id=p_session_id and user_id=actor for update;
  if not found then raise sqlstate 'PT404' using message='SESSION_NOT_FOUND'; end if;
  fingerprint := encode(sha256(convert_to(p_notes,'UTF8')),'hex');
  select * into receipt from private.note_operations where user_id=actor and operation_id=p_operation_id;
  if found then
    if receipt.session_id<>p_session_id or receipt.expected_revision<>p_expected_revision or receipt.content_hash<>fingerprint then
      raise sqlstate 'PT409' using message='OPERATION_ID_REUSED';
    end if;
    return jsonb_build_object('session',to_jsonb(saved),'noteWrite',jsonb_build_object('operationId',p_operation_id,'appliedRevision',receipt.applied_revision,'replayed',true));
  end if;
  if saved.notes_revision<>p_expected_revision then raise sqlstate 'PT409' using message='NOTES_CONFLICT',detail=to_jsonb(saved)::text; end if;
  update public.study_sessions set notes=p_notes,notes_revision=notes_revision+1,notes_updated_at=clock_timestamp() where id=p_session_id returning * into saved;
  insert into public.notes(user_id,session_id,content,word_count) values(actor,p_session_id,p_notes,
    case when btrim(p_notes)='' then 0 else cardinality(regexp_split_to_array(btrim(p_notes),'\s+')) end)
  on conflict(user_id,session_id) do update set content=excluded.content,word_count=excluded.word_count;
  insert into private.note_operations(user_id,operation_id,session_id,expected_revision,content_hash,applied_revision) values(actor,p_operation_id,p_session_id,p_expected_revision,fingerprint,saved.notes_revision);
  perform private.append_event(jsonb_build_object('user_id',actor,'event_type','note.saved','category','study','outcome','succeeded','source','database','resource_type','study_session','resource_id',p_session_id,'activity_id',p_operation_id,'dedup_key','note:'||actor||':'||p_operation_id,'properties',jsonb_build_object('revision',saved.notes_revision)));
  return jsonb_build_object('session',to_jsonb(saved),'noteWrite',jsonb_build_object('operationId',p_operation_id,'appliedRevision',saved.notes_revision,'replayed',false));
end $$;
revoke all on function public.save_session_notes(uuid,text,bigint,uuid) from public,anon;
grant execute on function public.save_session_notes(uuid,text,bigint,uuid) to authenticated;
create or replace function private.session_outcomes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    perform private.append_event(jsonb_build_object('user_id',new.user_id,'event_type','study_session.created','category','study','outcome','succeeded','source','database','resource_type','study_session','resource_id',new.id,'dedup_key','session:create:'||new.id,'properties','{}'::jsonb));
  end if;
  return new;
end $$;
create trigger stabilization_session_created after insert on public.study_sessions for each row execute function private.session_outcomes();
create or replace function public.get_session_note_variants(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_user(auth.uid()) or not exists(select 1 from public.study_sessions where id=p_session_id and user_id=auth.uid()) then raise insufficient_privilege; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',note_id,'content',projection_content,'preservedAt',preserved_at) order by preserved_at,note_id) from private.note_legacy_variants where session_id=p_session_id and user_id=auth.uid()),'[]'::jsonb);
end $$;
revoke all on function public.get_session_note_variants(uuid) from public,anon;
grant execute on function public.get_session_note_variants(uuid) to authenticated;
