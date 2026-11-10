-- ROYAL MOTORS Admin: Supabase setup
-- ---------------------------------------------------------------------------
-- Review this file, then run it in Supabase: SQL Editor, New query, paste,
-- Run. The whole file runs as one transaction: if any statement fails,
-- nothing is changed. It is safe to re-run.
--
-- Rules this script follows:
--   - Existing policies are kept as they are (none are dropped or edited).
--   - Existing rows are kept. Only new columns are added, plus the photos
--     column is filled from image_url (image_url itself is not changed).
--   - Only admins (public.profiles.role = 'admin') can add, change or
--     delete cars and customers. This is enforced with RESTRICTIVE
--     policies, so it holds even if an older policy allows more.
--   - Visitors (anon) can read Available and Reserved cars only, without
--     signing in, and nothing else.
--   - TRUNCATE, TRIGGER and REFERENCES are removed from anon and
--     authenticated on cars, customers and profiles.
--   - Objects created here use the rm_ / "rm: " prefix.
-- ---------------------------------------------------------------------------

-- 0. Safety checks -----------------------------------------------------------
-- Stop (and change nothing) if a table is missing or RLS is off. Existing
-- policies are listed as NOTICE messages so you can see they are kept.
do $$
declare
  t      text;
  rls_on boolean;
  p      record;
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
        'Row Level Security is OFF on public.%. Nothing was changed. Review it and enable it yourself with: alter table public.% enable row level security;',
        t, t;
    end if;
  end loop;

  for p in
    select tablename, policyname, cmd, permissive, roles
      from pg_policies
     where schemaname = 'public'
       and tablename in ('cars', 'customers', 'profiles')
       and left(policyname, 4) <> 'rm: '
  loop
    raise notice 'Keeping existing policy %.% (%, %, roles %)',
      p.tablename, p.policyname, p.cmd, p.permissive, p.roles;
  end loop;
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

-- 2. Car status values ------------------------------------------------------
-- The existing check constraint allows only 'available' and 'sold'. It is
-- replaced by one that also allows 'reserved' and 'draft'. The new rule is
-- a superset of the old one, so every existing row still passes. If any row
-- did not pass, the ADD below would fail and the whole script would be
-- rolled back with no changes.
do $$
declare
  status_attnum smallint;
  con           record;
begin
  select attnum into status_attnum
    from pg_attribute
   where attrelid = 'public.cars'::regclass and attname = 'status' and not attisdropped;

  -- Only single-column CHECK constraints on cars.status are replaced.
  for con in
    select conname
      from pg_constraint
     where conrelid = 'public.cars'::regclass
       and contype = 'c'
       and conkey = array[status_attnum]
       and conname <> 'rm_cars_status_check'
  loop
    raise notice 'Replacing status constraint % (%)', con.conname,
      pg_get_constraintdef((select oid from pg_constraint
                             where conrelid = 'public.cars'::regclass and conname = con.conname));
    execute format('alter table public.cars drop constraint %I', con.conname);
  end loop;

  -- A multi-column CHECK that also uses status is NOT dropped. If one
  -- exists it could still block 'reserved'/'draft', so stop and change
  -- nothing; review it by hand first.
  for con in
    select conname
      from pg_constraint
     where conrelid = 'public.cars'::regclass
       and contype = 'c'
       and status_attnum = any (conkey)
       and cardinality(conkey) > 1
  loop
    raise exception
      'Constraint % on public.cars uses status together with other columns: %. Nothing was changed. Review it first.',
      con.conname,
      pg_get_constraintdef((select oid from pg_constraint
                             where conrelid = 'public.cars'::regclass and conname = con.conname));
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.cars'::regclass and conname = 'rm_cars_status_check'
  ) then
    alter table public.cars
      add constraint rm_cars_status_check
      check (lower(status::text) in ('available', 'reserved', 'sold', 'draft'));
  end if;
end;
$$;

-- If status / fuel_type / transmission are Postgres enums, add the values
-- the dashboard uses. Plain text columns are left as they are.
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

-- 3. Admin check --------------------------------------------------------------

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

-- Extra protection for profiles: a browser user who is not an admin can
-- never create an admin profile or change a role, even if an existing or
-- future policy allows profile writes. Normal sign-up is not affected.
create or replace function public.rm_guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only requests made directly from the browser are checked. Sign-up
  -- (supabase_auth_admin), handle_new_user-style SECURITY DEFINER triggers
  -- (postgres), the SQL Editor and the service role are never blocked.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  -- Normal profiles (any role other than admin) are allowed as before.
  if tg_op = 'INSERT' and new.role::text is distinct from 'admin' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return new;
  end if;

  -- Creating an admin profile or changing a role needs an admin.
  if current_user = 'anon' or not coalesce(public.rm_is_admin(), false) then
    raise exception 'Only an admin can create an admin profile or change a role.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists rm_guard_profile_role on public.profiles;
create trigger rm_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.rm_guard_profile_role();

-- 4. Table privileges -----------------------------------------------------------
-- Remove privileges the browser never needs.
revoke truncate, trigger, references
  on public.cars, public.customers, public.profiles
  from public, anon, authenticated;

-- Visitors: read cars only, and only the listed columns. RLS (section 5)
-- limits the rows to Available and Reserved cars. No access to customers
-- or profiles, and no writes anywhere.
grant select (id, make, model, year, price, condition, body_type, mileage, engine,
              fuel_type, transmission, colour, status, featured, photos, image_url,
              description, created_at, updated_at)
  on public.cars to anon;

-- Signed-in users: the dashboard needs these. RLS (section 5) allows the
-- writes for admins only.
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

-- 5. Row Level Security policies ------------------------------------------------
-- PERMISSIVE policies grant access; RESTRICTIVE policies are extra
-- conditions that every request must also pass. Existing permissive
-- policies are kept, and the restrictive ones below cap what they can do.

-- cars: visitors and signed-in users see Available/Reserved cars.
drop policy if exists "rm: anyone reads listed cars" on public.cars;
create policy "rm: anyone reads listed cars"
  on public.cars as permissive for select to anon, authenticated
  using (lower(status::text) in ('available', 'reserved'));

drop policy if exists "rm: visitors only see listed cars" on public.cars;
create policy "rm: visitors only see listed cars"
  on public.cars as restrictive for select to anon
  using (lower(status::text) in ('available', 'reserved'));

drop policy if exists "rm: users see listed cars unless admin" on public.cars;
create policy "rm: users see listed cars unless admin"
  on public.cars as restrictive for select to authenticated
  using (lower(status::text) in ('available', 'reserved') or (select public.rm_is_admin()));

-- cars: only admins write.
drop policy if exists "rm: admins manage cars" on public.cars;
create policy "rm: admins manage cars"
  on public.cars as permissive for all to authenticated
  using ((select public.rm_is_admin()))
  with check ((select public.rm_is_admin()));

drop policy if exists "rm: only admins insert cars" on public.cars;
create policy "rm: only admins insert cars"
  on public.cars as restrictive for insert to authenticated
  with check ((select public.rm_is_admin()));

drop policy if exists "rm: only admins update cars" on public.cars;
create policy "rm: only admins update cars"
  on public.cars as restrictive for update to authenticated
  using ((select public.rm_is_admin()))
  with check ((select public.rm_is_admin()));

drop policy if exists "rm: only admins delete cars" on public.cars;
create policy "rm: only admins delete cars"
  on public.cars as restrictive for delete to authenticated
  using ((select public.rm_is_admin()));

-- customers: admins only, for reading and writing.
drop policy if exists "rm: admins manage customers" on public.customers;
create policy "rm: admins manage customers"
  on public.customers as permissive for all to authenticated
  using ((select public.rm_is_admin()))
  with check ((select public.rm_is_admin()));

drop policy if exists "rm: only admins use customers" on public.customers;
create policy "rm: only admins use customers"
  on public.customers as restrictive for all to authenticated
  using ((select public.rm_is_admin()))
  with check ((select public.rm_is_admin()));

-- profiles: each user reads their own row (the dashboard checks the role);
-- admins may read all.
drop policy if exists "rm: users read own profile" on public.profiles;
create policy "rm: users read own profile"
  on public.profiles as permissive for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "rm: profiles own row or admin" on public.profiles;
create policy "rm: profiles own row or admin"
  on public.profiles as restrictive for select to authenticated
  using (id = (select auth.uid()) or (select public.rm_is_admin()));

-- 6. Read-only view for the customer website ------------------------------------
-- The website can read this without signing in. security_invoker means the
-- visitor's own privileges and the cars policies above apply, so only
-- Available/Reserved cars are returned.

create or replace view public.public_cars
with (security_invoker = true) as
  select id, make, model, year, price, condition, body_type, mileage, engine,
         fuel_type, transmission, colour, status, featured, photos, image_url,
         description, created_at, updated_at
    from public.cars
   where lower(status::text) in ('available', 'reserved');

alter view public.public_cars set (security_invoker = true);
revoke all on public.public_cars from public, anon, authenticated;
grant select on public.public_cars to anon, authenticated;

-- 7. Storage: car-photos bucket --------------------------------------------------
-- An existing bucket with the same name is left exactly as it is.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Only policies named "rm: ..." are dropped and re-created here. Existing
-- storage policies (other names, other buckets) are not touched.
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

-- Restrictive caps for car-photos only: even if an older storage policy
-- lets any user upload, nobody except an admin can add, change or delete
-- files in car-photos. Every other bucket passes these checks unchanged.
drop policy if exists "rm: car-photos visitors cannot write" on storage.objects;
create policy "rm: car-photos visitors cannot write"
  on storage.objects as restrictive for all to anon
  using (bucket_id is distinct from 'car-photos')
  with check (bucket_id is distinct from 'car-photos');

drop policy if exists "rm: car-photos only admins insert" on storage.objects;
create policy "rm: car-photos only admins insert"
  on storage.objects as restrictive for insert to authenticated
  with check (bucket_id is distinct from 'car-photos' or (select public.rm_is_admin()));

drop policy if exists "rm: car-photos only admins update" on storage.objects;
create policy "rm: car-photos only admins update"
  on storage.objects as restrictive for update to authenticated
  using (bucket_id is distinct from 'car-photos' or (select public.rm_is_admin()))
  with check (bucket_id is distinct from 'car-photos' or (select public.rm_is_admin()));

drop policy if exists "rm: car-photos only admins delete" on storage.objects;
create policy "rm: car-photos only admins delete"
  on storage.objects as restrictive for delete to authenticated
  using (bucket_id is distinct from 'car-photos' or (select public.rm_is_admin()));

-- Make PostgREST pick up the changes right away.
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
