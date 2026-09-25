-- Support the foreign-key work performed when a conversation is deleted.
-- Messages already have study_messages_session_id_created_at_idx.
create index if not exists notes_session_id_idx
  on public.notes (session_id);

create index if not exists uploaded_materials_session_id_fk_idx
  on public.uploaded_materials (session_id)
  where session_id is not null;
