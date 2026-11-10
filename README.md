# ROYAL MOTORS — Admin Dashboard

Private, mobile-friendly admin console for ROYAL MOTORS (Tanzania), separate from the customer website: https://royal-motor.netlify.app/.

## Features
- Supabase email/password admin sign-in and password reset
- Inventory overview, add/edit/delete cars, status and featured controls
- Multiple car-photo uploads to the Supabase Storage `car-photos` bucket
- Customer enquiry pipeline and one-tap WhatsApp contact
- Responsive desktop sidebar and mobile navigation
- Supabase-backed data with no sample-data fallback

## Project structure
- `src/routes/`: sign-in, admin layout, dashboard, cars, customers, password reset
- `src/components/`: admin shell, car/customer editors, shared UI
- `src/lib/`: Supabase client, auth, database mapping, inventory store, photo uploads
- `public/img/`: local showroom images
- `supabase/inspect.sql`: read-only inspection of the existing database
- `supabase/setup.sql`: database setup script; review before running

## Required Netlify environment variables
Set these in the admin site's Netlify environment settings:
- `VITE_SUPABASE_URL`: the existing Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: the public anon/publishable key

Never put a Supabase service-role key in browser variables or commit secrets to GitHub.

## Supabase setup
The dashboard uses `public.cars`, `public.customers`, and `public.profiles`, plus the `car-photos` Storage bucket. First review `supabase/inspect.sql` and your existing RLS policies. Do not run `supabase/setup.sql` until its effects have been reviewed against your live project. It may add columns and policies and adjust the cars status constraint.

## Run locally
```bash
pnpm install
pnpm dev
```

Checks:
```bash
pnpm typecheck
pnpm test
pnpm build
```

This repository is the admin dashboard only. Do not use it to replace or deploy the customer website.