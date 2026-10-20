-- One-use PKCE recovery intent/proof. No passwords, addresses, raw links or tokens are persisted.
create table if not exists private.recovery_intents(
  nonce_hash text primary key,browser_hash text not null,email_hash text not null,rate_key text not null,
  created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',consumed_at timestamptz
);
create index if not exists recovery_intents_rate_idx on private.recovery_intents(rate_key,created_at);
create index if not exists recovery_intents_browser_idx on private.recovery_intents(browser_hash,created_at);
create table if not exists private.recovery_proofs(
  proof_hash text primary key,user_id uuid not null references auth.users(id) on delete cascade,session_id uuid not null,
  expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',consumed_at timestamptz
);
create or replace function public.create_recovery_intent(p_nonce_hash text,p_browser_hash text,p_email_hash text,p_rate_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (p_nonce_hash ~ '^[a-f0-9]{64}$' and p_browser_hash ~ '^[a-f0-9]{64}$' and p_email_hash ~ '^[a-f0-9]{64}$' and p_rate_key ~ '^[a-f0-9]{64}$') is not true then raise exception 'Invalid recovery intent'; end if;
  perform pg_advisory_xact_lock(917213);
  if (select count(*) from private.recovery_intents where created_at>clock_timestamp()-interval '15 minutes')>=100
    or (select count(*) from private.recovery_intents where rate_key=p_rate_key and created_at>clock_timestamp()-interval '15 minutes')>=3
    or (select count(*) from private.recovery_intents where browser_hash=p_browser_hash and created_at>clock_timestamp()-interval '15 minutes')>=10 then return false; end if;
  insert into private.recovery_intents(nonce_hash,browser_hash,email_hash,rate_key) values(p_nonce_hash,p_browser_hash,p_email_hash,p_rate_key);
  perform private.append_event(jsonb_build_object('event_type','auth.recovery.requested','category','auth','outcome','attempted','source','server','actor_type','anonymous','properties','{}'::jsonb));
  return true;
end $$;
create or replace function public.authorize_recovery_intent(p_nonce_hash text,p_browser_hash text,p_email_hash text,p_user_id uuid,p_session_id uuid,p_proof_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare intent private.recovery_intents;
begin
  select * into intent from private.recovery_intents where nonce_hash=p_nonce_hash for update;
  if not found or intent.consumed_at is not null or intent.expires_at<=clock_timestamp() or (intent.browser_hash=p_browser_hash and intent.email_hash=p_email_hash and p_proof_hash ~ '^[a-f0-9]{64}$' and p_user_id is not null and p_session_id is not null) is not true then return false; end if;
  update private.recovery_intents set consumed_at=clock_timestamp() where nonce_hash=p_nonce_hash;
  insert into private.recovery_proofs(proof_hash,user_id,session_id) values(p_proof_hash,p_user_id,p_session_id);
  return true;
end $$;
create or replace function public.validate_recovery_proof(p_proof_hash text,p_user_id uuid,p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.recovery_proofs where proof_hash=p_proof_hash and user_id=p_user_id and session_id=p_session_id and consumed_at is null and expires_at>now())
$$;
create or replace function public.consume_recovery_proof(p_proof_hash text,p_user_id uuid,p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.recovery_proofs set consumed_at=clock_timestamp() where proof_hash=p_proof_hash and user_id=p_user_id and session_id=p_session_id and consumed_at is null and expires_at>clock_timestamp();
  return found;
end $$;
revoke all on function public.create_recovery_intent(text,text,text,text),public.authorize_recovery_intent(text,text,text,uuid,uuid,text),public.validate_recovery_proof(text,uuid,uuid),public.consume_recovery_proof(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_recovery_intent(text,text,text,text),public.authorize_recovery_intent(text,text,text,uuid,uuid,text),public.validate_recovery_proof(text,uuid,uuid),public.consume_recovery_proof(text,uuid,uuid) to service_role;
create or replace function public.cleanup_recovery_receipts(p_batch_size int default 1000) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; total int;
begin
  if p_batch_size is null or p_batch_size not between 1 and 5000 then raise exception 'Invalid cleanup bound'; end if;
  with expired as (select nonce_hash from private.recovery_intents where expires_at<now()-interval '1 hour' order by expires_at limit p_batch_size for update skip locked) delete from private.recovery_intents i using expired e where i.nonce_hash=e.nonce_hash;
  get diagnostics total = row_count;
  with expired as (select proof_hash from private.recovery_proofs where expires_at<now()-interval '1 hour' order by expires_at limit p_batch_size for update skip locked) delete from private.recovery_proofs p using expired e where p.proof_hash=e.proof_hash;
  get diagnostics n = row_count; return total+n;
end $$;
revoke all on function public.cleanup_recovery_receipts(int) from public,anon,authenticated;
grant execute on function public.cleanup_recovery_receipts(int) to service_role;
