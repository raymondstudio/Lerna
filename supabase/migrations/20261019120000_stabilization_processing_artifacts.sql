-- Private retry artifacts contain derived material data, never activity metadata.
-- Only the server's current owned processing claim can read or create them.
create table private.material_processing_artifacts (
  material_id uuid not null references public.uploaded_materials(id) on delete cascade,
  artifact_key text not null check (artifact_key ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('extraction','embedding')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key(material_id,artifact_key,kind)
);
revoke all on private.material_processing_artifacts from public,anon,authenticated;

create function private.require_material_claim(p_material_id uuid,p_claim_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from private.material_processing_claims c join public.uploaded_materials m on m.id=c.material_id and m.user_id=c.user_id
    where c.material_id=p_material_id and c.claim_id=p_claim_id and c.expires_at>clock_timestamp() and m.deleted_at is null and public.is_active_user(c.user_id) for update of m,c;
  if not found then raise insufficient_privilege; end if;
end $$;
create function public.get_material_processing_artifact(p_material_id uuid,p_claim_id uuid,p_key text,p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_material_claim(p_material_id,p_claim_id);
  return (select payload from private.material_processing_artifacts where material_id=p_material_id and artifact_key=p_key and kind=p_kind);
end $$;
create function public.put_material_processing_artifact(p_material_id uuid,p_claim_id uuid,p_key text,p_kind text,p_payload jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare segment jsonb;
begin
  perform private.require_material_claim(p_material_id,p_claim_id);
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'array' or octet_length(p_payload::text)>1200000 then raise exception 'Invalid processing artifact'; end if;
  if p_kind='embedding' then
    if jsonb_array_length(p_payload)<>768 then raise exception 'Invalid embedding dimensions'; end if;
    for segment in select value from jsonb_array_elements(p_payload) loop
      if jsonb_typeof(segment) is distinct from 'number' or abs(segment::text::numeric)>1e100 then raise exception 'Invalid embedding value'; end if;
    end loop;
  elsif p_kind='extraction' then
    if jsonb_array_length(p_payload)>100 or (select coalesce(sum(length(value->>'text')),0) from jsonb_array_elements(p_payload))>200000 then raise exception 'Invalid extraction size'; end if;
    for segment in select value from jsonb_array_elements(p_payload) loop
      if jsonb_typeof(segment) is distinct from 'object' or jsonb_typeof(segment->'text') is distinct from 'string' then raise exception 'Invalid extraction segment'; end if;
    end loop;
  else raise exception 'Invalid artifact kind'; end if;
  insert into private.material_processing_artifacts(material_id,artifact_key,kind,payload) values(p_material_id,p_key,p_kind,p_payload)
    on conflict(material_id,artifact_key,kind) do nothing;
  return true;
end $$;
revoke all on function private.require_material_claim(uuid,uuid),public.get_material_processing_artifact(uuid,uuid,text,text),public.put_material_processing_artifact(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.get_material_processing_artifact(uuid,uuid,text,text),public.put_material_processing_artifact(uuid,uuid,text,text,jsonb) to service_role;

-- Delete derived content only when the exact tombstone cleanup obligation is
-- acknowledged. Index-only retries retain it to avoid repeating paid work.
create or replace function public.complete_material_cleanup(p_material_id uuid,p_expected_revision bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare job private.material_cleanup_jobs;
begin
  if p_expected_revision is null then raise sqlstate 'PT428' using message='CLEANUP_REVISION_REQUIRED'; end if;
  select * into job from private.material_cleanup_jobs where material_id=p_material_id and revision=p_expected_revision for update;
  if not found then return false; end if;
  if job.remove_storage then delete from private.material_processing_artifacts where material_id=p_material_id; end if;
  delete from private.material_cleanup_jobs where material_id=p_material_id and revision=p_expected_revision;
  return true;
end $$;
