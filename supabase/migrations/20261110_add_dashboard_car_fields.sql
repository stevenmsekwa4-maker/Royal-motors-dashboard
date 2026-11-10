-- Royal Motors Admin Dashboard: additive car fields
-- Review this file before running it in the Supabase SQL Editor.
-- This migration does NOT drop tables/columns, change existing RLS policies,
-- change grants, create storage buckets, or delete/overwrite car records.
--
-- Existing public.cars columns confirmed by the project owner:
-- id, make, model, year, price, mileage, transmission, fuel_type,
-- description, image_url, status, created_at.

begin;

alter table public.cars
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists condition text,
  add column if not exists body_type text,
  add column if not exists engine text,
  add column if not exists colour text,
  add column if not exists featured boolean not null default false,
  add column if not exists updated_at timestamptz;

-- Preserve the current cover image. The dashboard stores the full gallery
-- in photos and continues writing the first photo to image_url for the
-- existing customer website.
update public.cars
set photos = jsonb_build_array(image_url)
where image_url is not null
  and btrim(image_url) <> ''
  and (photos is null or photos = '[]'::jsonb);

-- Backfill only what can be inferred from existing data:
-- mileage = 0 is treated as new; positive mileage as used.
-- Unknown mileage remains NULL rather than inventing a condition.
update public.cars
set condition = case
  when mileage = 0 then 'new'
  when mileage > 0 then 'used'
  else condition
end
where condition is null
  and mileage is not null;

-- Use the existing creation timestamp as the initial update timestamp.
update public.cars
set updated_at = created_at
where updated_at is null
  and created_at is not null;

commit;

-- After running, verify with:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'cars'
-- order by ordinal_position;
--
-- IMPORTANT:
-- 1. This migration does not configure public read access or admin RLS.
--    Existing policies must be reviewed separately before changing access.
-- 2. This migration does not create the 'car-photos' Storage bucket or its
--    policies. Review Storage configuration separately before photo uploads.
-- 3. The dashboard's customer-management screen also expects columns on
--    public.customers. That table's current schema must be inspected before
--    preparing a separate additive migration; no customer columns are guessed
--    or changed in this file.
