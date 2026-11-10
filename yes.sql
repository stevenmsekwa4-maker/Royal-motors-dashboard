-- ROYAL MOTORS Admin: Supabase setup (STEP 2)
-- ---------------------------------------------------------------------------
-- Run supabase/inspect.sql FIRST and review the existing policies.
-- Then run this file in Supabase: SQL Editor, then New query, paste, Run.
-- It is safe to re-run.
--
-- This script is ADDITIVE ONLY:
--   - It never drops, renames or changes an existing policy, column, table,
--     view or function. Every object it creates is prefixed "rm_" / "rm:",
--     so it cannot collide with what the customer website already uses.
--   - It never revokes a privilege. It does not touch existing rows (except
--     filling the new photos column from image_url).
--   - It does not enable or disable RLS. If RLS is off on one of the three
--     tables, it stops and changes nothing.
--   - If the three tables already have policies, it stops and changes
--     nothing until you confirm you have reviewed them (step 0 below).
--
-- What it adds:
--   1. Columns the dashboard needs (new columns only, with safe defaults).
--   2. rm_is_admin(): true when public.profiles.role = 'admin'.
--   3. A guard trigger so only admins can give or change a profile role.
--   4. Privileges for signed-in users, plus admin-only policies:
--        cars and customers: full access for admins only;
--        profiles: each user can read their own row.
--      Visitors (anon) get no direct access to cars, customers or profiles.
--   5. A public_cars view (Available/Reserved cars only) for the website.
--   6. The car-photos storage bucket with admin-only upload/change/delete.
-- ---------------------------------------------------------------------------

-- 0. Confirmation ------------------------------------------------------------
-- After reviewing the output of inspect.sql, change 'no' to 'yes' below.
-- Only needed when the tables already have policies.
select set_config('rm.policies_reviewed', 'yes', false);

do $$
declare
  t        text;
  rls_on   boolean;
  existing text;
begin
  foreach t in array array['cars', 'customers', 'profiles'] loop
    select c.relrowsecurity into rls_on
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t;

    if rls_on is null then
      raise exception 'Table public.% does not exist. Nothing was changed.', t;
    end if;
    if not rls_on then
      raise exception
        'Row Level Security is OFF on public.%. Nothing was changed. Turning it on changes who can read this table, so review inspect.sql first and enable it yourself with: alter table public.% enable row level security;',
        t, t;
    end if;
  end loop;

  select string_agg(tablename || ' :: ' || policyname, '; ' order by tablename, policyname)
    into existing
    from pg_policies
   where schemaname = 'public'
     and tablename in ('cars', 'customers', 'profiles')
     and left(policyname, 4) <> 'rm: ';

  if existing is not null
     and coalesce(current_setting('rm.policies_reviewed', true), 'no') <> 'yes' then
    raise exception
      'Existing policies found (they will be kept, not changed): %. Nothing was changed. Review them with inspect.sql, then set rm.policies_reviewed to yes at the top of this file and run it again.',
      existing;
  end if;
end;
$$;

-- 1. Columns ----------------------------------------------------------------

alter table public.cars add column if not exists condition   text        not null default 'used';
alter table public.cars add column if not exists body_type   text;
alter table public.cars add column if not exists engine      text;
alter table public.cars add column if not exists colour      text;
alter table public.cars add column if not exists featured    boolean     not null default false;
alter table public.cars add column if not exists photos      text[]      not null default '{}';
alter table public.cars add column if not exists updated_at  timestamptz not null default now();

-- Fill the new photo gallery from the existing single cover image.
-- image_url itself is not changed.
update public.cars
   set photos = array[image_url]
 where image_url is not null and image_url <> '' and cardinality(photos) = 0;

create or replace function public.rm_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rm_cars_set_updated_at on public.cars;
create trigger rm_cars_set_updated_at
  before update on public.cars
  for each row execute function public.rm_set_updated_at();

alter table public.customers add column if not exists source  text not null default 'whatsapp';
alter table public.customers add column if not exists status  text not null default 'new';
alter table public.customers add column if not exists request text;
alter table public.customers add column if not exists budget  bigint;

-- interested_car_id uses the same type as cars.id (uuid or bigint).
do $$
declare
  id_type text;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'customers'
       and column_name = 'interested_car_id'
  ) then
    select format_type(a.atttypid, a.atttypmod) into id_type
      from pg_attribute a
     where a.attrelid = 'public.cars'::regclass and a.attname = 'id';
    execute format(
      'alter table public.customers add column interested_car_id %s references public.cars(id) on delete set null',
      id_type
    );
  end if;
end;
$$;

-- If status / fuel_type / transmission are Postgres enums, add the values
-- the dashboard uses. Existing values are kept. Plain text columns are
-- left as they are.
do $$
declare
  col  record;
  vals text[];
  val  text;
begin
  for col in
    select c.column_name, t.typname, n.nspname
      from information_schema.columns c
      join pg_namespace n on n.nspname = c.udt_schema
      join pg_type t on t.typnamespace = n.oid
                    and t.typname = c.udt_name
                    and t.typtype = 'e'
     where c.table_schema = 'public'
       and c.table_name = 'cars'
       and c.column_name in ('status', 'fuel_type', 'transmission')
  loop
    vals := case col.column_name
              when 'status'    then array['draft', 'available', 'reserved', 'sold']
              when 'fuel_type' then array['Petrol', 'Diesel', 'Hybrid', 'Electric']
              else                  array['Automatic', 'Manual']
            end;

    foreach val in array vals loop
      execute format(
        'alter type %I.%I add value if not exists %L',
        col.nspname, col.typname, val
      );
    end loop;
  end loop;
end;
$$;

-- 2. Admin check --------------------------------------------------------------

create or replace function public.rm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role::text = 'admin'
  );
$$;

revoke all on function public.rm_is_admin() from public, anon;
grant execute on function public.rm_is_admin() to authenticated;

-- 3. Role guard on profiles ----------------------------------------------------
-- Existing profile policies are kept. This trigger only stops a signed-in
-- non-admin (or a visitor) from making anyone an admin or changing a role.
-- Changes made in the SQL Editor, by server code with the service role, or
-- by Supabase's own sign-up triggers are not affected.

create or replace function public.rm_guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not coalesce(public.rm_is_admin(), false) then
    if tg_op = 'INSERT' and new.role::text = 'admin' then
      raise exception 'Only an admin can create an admin profile.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Only an admin can change a profile role.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

grant execute on function public.rm_guard_profile_role() to anon, authenticated;

drop trigger if exists rm_guard_profile_role on public.profiles;
create trigger rm_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.rm_guard_profile_role();

-- 4. Privileges and admin policies ----------------------------------------------
-- Grants only add access (nothing is revoked). RLS policies decide which
-- rows each signed-in user can reach.

grant select, insert, update, delete on public.cars, public.customers to authenticated;
grant select on public.profiles to authenticated;

-- Sequences behind serial/identity ids on cars and customers only.
do $$
declare
  t   text;
  seq text;
begin
  foreach t in array array['cars', 'customers'] loop
    seq := pg_get_serial_sequence(format('public.%I', t), 'id');
    if seq is not null then
      execute format('grant usage, select on sequence %s to authenticated', seq);
    end if;
  end loop;
end;
$$;

drop policy if exists "rm: admins manage cars" on public.cars;
create policy "rm: admins manage cars"
  on public.cars for all to authenticated
  using ((select public.rm_is_admin()))
  with check ((select public.rm_is_admin()));

drop policy if exists "rm: admins manage customers" on public.customers;
create policy "rm: admins manage customers"
  on public.customers for all to authenticated
  using ((select public.rm_is_admin()))
  with check ((select public.rm_is_admin()));

drop policy if exists "rm: users read own profile" on public.profiles;
create policy "rm: users read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- 5. Read-only view for the customer website ------------------------------------
-- Visitors read cars ONLY through this view: Available/Reserved cars and
-- the listed columns. The view runs with its owner's rights, so it does not
-- depend on (or activate) any existing policies on public.cars.
-- If a public_cars view already exists with other columns, this statement
-- fails and the whole script is rolled back without changes.

create or replace view public.public_cars
with (security_invoker = false) as
  select id, make, model, year, price, condition, body_type, mileage, engine,
         fuel_type, transmission, colour, status, featured, photos, image_url,
         description, created_at, updated_at
    from public.cars
   where lower(status::text) in ('available', 'reserved');

alter view public.public_cars set (security_invoker = false);
grant select on public.public_cars to anon, authenticated;

-- 6. Storage: car-photos bucket --------------------------------------------------
-- An existing bucket with the same name is left exactly as it is.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "rm: car-photos admins read"   on storage.objects;
drop policy if exists "rm: car-photos admins upload" on storage.objects;
drop policy if exists "rm: car-photos admins update" on storage.objects;
drop policy if exists "rm: car-photos admins delete" on storage.objects;

-- Public photo URLs work without a policy because the bucket is public.
-- Listing and managing files is limited to admins.
create policy "rm: car-photos admins read"
  on storage.objects for select to authenticated
  using (bucket_id = 'car-photos' and (select public.rm_is_admin()));

create policy "rm: car-photos admins upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'car-photos' and (select public.rm_is_admin()));

create policy "rm: car-photos admins update"
  on storage.objects for update to authenticated
  using (bucket_id = 'car-photos' and (select public.rm_is_admin()))
  with check (bucket_id = 'car-photos' and (select public.rm_is_admin()));

create policy "rm: car-photos admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'car-photos' and (select public.rm_is_admin()));

-- Make PostgREST pick up the new columns right away.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Make an account an admin (run separately, replacing the email):
--
--   update public.profiles
--      set role = 'admin'
--    where id = (select id from auth.users where email = 'owner@example.com');
--
-- If that updates 0 rows (no profile yet), create it:
--
--   insert into public.profiles (id, role)
--   select id, 'admin' from auth.users where email = 'owner@example.com';
-- ---------------------------------------------------------------------------
