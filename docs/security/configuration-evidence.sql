-- Read-only configuration evidence; no private user rows or credential values.
-- Run only through approved owner read-only access or in isolated test database.
-- Record migration deployment separately; this file does not apply migrations.
select n.nspname as schema_name, c.relname as object_name, c.relkind,
       c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private','storage') and c.relkind in ('r','p','v','m')
order by 1,2;
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname in ('public','storage')
order by 1,2,3;
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role','PUBLIC')
order by 1,2,3,4;
select table_schema, table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema='public' and grantee in ('anon','authenticated','service_role','PUBLIC')
order by 1,2,3,4,5;
select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proacl, p.proconfig,
       pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') order by 1,2,3;
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
select rolname, rolbypassrls, rolsuper from pg_catalog.pg_roles
where rolname in ('anon','authenticated','service_role');
-- Separately obtain Data API exposed schemas, Auth redirect/MFA/revocation settings,
-- provider/deployed credential type and runtime metadata; SQL metadata cannot prove them.
