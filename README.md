# ROYAL MOTORS — Admin Dashboard

A private, mobile-friendly admin console for ROYAL MOTORS in Tanzania. It is a separate project from the public customer website: https://royal-motor.netlify.app/.

## Features

- Secure Supabase email/password sign-in; only users whose `profiles.role` is `admin` can enter.
- Overview of inventory and customer enquiries.
- Add, edit, publish, reserve, mark sold, and delete vehicles.
- Upload and manage up to 12 vehicle photos in Supabase Storage.
- Manage customer leads and open WhatsApp conversations.
- Responsive desktop and Android/mobile layouts.

All inventory and customer records are loaded from Supabase. There is no sample-data fallback.

## Supabase configuration

This dashboard uses the existing project:

- Project URL: `https://mlzedoeetcwevbtnhrnp.supabase.co`
- Project ref: `mlzedoeetcwevbtnhrnp`

Set these environment variables in Netlify (and in a local `.env` file):

- `VITE_SUPABASE_URL` — the project URL above.
- `VITE_SUPABASE_ANON_KEY` — the project's public publishable key (or legacy anon key).

A template is provided in `.env.example`. The public key is intended for browser use and must be protected by RLS. **Never put a Supabase service-role or secret key in a `VITE_*` variable or browser code.**

## One-time database setup

The database setup scripts are in `supabase/`:

1. Run `supabase/inspect.sql` in the Supabase SQL Editor first. It is read-only; review the existing policies, grants, columns and storage configuration.
2. Review `supabase/setup.sql`. It adds the fields and security rules required by this dashboard, preserves existing data and non-Royal-Motors policies, creates the read-only `public_cars` view, and configures the `car-photos` bucket policies. Run it only after reviewing the inspection results.
3. Create the owner's user in Supabase Authentication, then set that user's `public.profiles.role` to `admin` using the SQL comment at the end of `supabase/setup.sql`. The project currently has one admin profile; verify that it belongs to the intended owner before signing in.

The dashboard and customer website both use `public.cars` as the source of vehicle records. The customer website reads only public statuses; customer records remain admin-only.

## Run locally

Requires Node.js 24 (or a supported current Node version) and pnpm.

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Deployment

Deploy this repository as its own private admin site. Do not connect its build to, replace, or deploy over the customer website. Configure the two `VITE_SUPABASE_*` variables in the admin site's Netlify environment before its first deployment.
