-- ROYAL MOTORS Admin: read-only inspection (STEP 1)
-- ---------------------------------------------------------------------------
-- Run this BEFORE setup.sql in Supabase: SQL Editor, then New query, paste,
-- Run. It only reads the system catalogs. It does not change any table,
-- policy, grant or data.
--
-- The SQL Editor shows only the last result, so everything is returned as
-- one table: section | object | detail.
-- ---------------------------------------------------------------------------

with t(name) as (values ('cars'), ('customers'), ('profiles'))

-- 1. Is Row Level Security on for each table?
select '1 rls'                         as section,
       'public.' || c.relname          as object,
       'rls_enabled=' || c.relrowsecurity || ', force_rls=' || c.relforcerowsecurity
         || ', owner=' || pg_get_userbyid(c.relowner) as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where c.relname in (select name from t)

union all

-- 2. Every existing policy on the three tables and on storage.objects.
select '2 policy',
       p.schemaname || '.' || p.tablename || ' :: ' || p.policyname,
       'cmd=' || p.cmd
         || ', permissive=' || p.permissive
         || ', roles=' || array_to_string(p.roles, ',')
         || ', using=' || coalesce(p.qual, '-')
         || ', with_check=' || coalesce(p.with_check, '-')
  from pg_policies p
 where (p.schemaname = 'public' and p.tablename in (select name from t))
    or (p.schemaname = 'storage' and p.tablename = 'objects')

union all

-- 3. Table privileges for the browser roles (anon = visitors, authenticated
--    = any signed-in user). Policies only matter where a privilege exists.
select '3 grant',
       g.table_schema || '.' || g.table_name,
       g.grantee || ': ' || string_agg(g.privilege_type, ',' order by g.privilege_type)
  from information_schema.role_table_grants g
 where g.table_schema = 'public'
   and g.table_name in (select name from t)
   and g.grantee in ('anon', 'authenticated', 'public')
 group by g.table_schema, g.table_name, g.grantee

union all

-- 4. Columns and types.
select '4 column',
       'public.' || c.table_name || '.' || c.column_name,
       c.data_type || ' (' || c.udt_name || ')'
         || ', nullable=' || c.is_nullable
         || ', default=' || coalesce(c.column_default, '-')
  from information_schema.columns c
 where c.table_schema = 'public' and c.table_name in (select name from t)

union all

-- 5. Check constraints (for example, allowed status values).
select '5 check',
       'public.' || cl.relname || ' :: ' || co.conname,
       pg_get_constraintdef(co.oid)
  from pg_constraint co
  join pg_class cl on cl.oid = co.conrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
 where co.contype = 'c' and cl.relname in (select name from t)

union all

-- 6. Triggers on the three tables.
select '6 trigger',
       'public.' || cl.relname || ' :: ' || tg.tgname,
       pg_get_triggerdef(tg.oid)
  from pg_trigger tg
  join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
 where not tg.tgisinternal and cl.relname in (select name from t)

union all

-- 7. Functions that already exist with names this project uses.
select '7 function',
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'security_definer=' || p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname in ('is_admin', 'set_updated_at')
    or left(p.proname, 3) = 'rm_'

union all

-- 8. Storage buckets.
select '8 bucket',
       b.id,
       'public=' || b.public
         || ', size_limit=' || coalesce(b.file_size_limit::text, '-')
         || ', mime=' || coalesce(array_to_string(b.allowed_mime_types, ','), '-')
  from storage.buckets b

union all

-- 9. Views in public (for example, an existing public_cars).
select '9 view',
       'public.' || v.table_name,
       'exists'
  from information_schema.views v
 where v.table_schema = 'public'

order by 1, 2;
