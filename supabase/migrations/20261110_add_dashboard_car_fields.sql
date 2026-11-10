-- Royal Motors Admin Dashboard: additive car fields, compatible with the live schema.
-- The live project already has photos as text[] (not jsonb), plus the
-- dashboard fields below. This migration is safe to re-run and preserves
-- existing photo URLs and car records.

begin;

alter table public.cars
  add column if not exists photos text[] not null default '{}'::text[],
  add column if not exists condition text default 'used',
  add column if not exists body_type text default 'SUV',
  add column if not exists engine text,
  add column if not exists colour text,
  add column if not exists featured boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Only seed an empty photo gallery from the existing cover image.
-- Existing photos are never replaced.
update public.cars
set photos = array[image_url]
where image_url is not null
  and btrim(image_url) <> ''
  and coalesce(cardinality(photos), 0) = 0;

-- Infer condition only when mileage makes it unambiguous.
update public.cars
set condition = case
  when mileage = 0 then 'new'
  when mileage > 0 then 'used'
  else condition
end
where condition is null
  and mileage is not null;

update public.cars
set updated_at = coalesce(created_at, now())
where updated_at is null;

commit;

-- Verify the live schema:
-- select column_name, data_type, udt_name
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'cars'
-- order by ordinal_position;
