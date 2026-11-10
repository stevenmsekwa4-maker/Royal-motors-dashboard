# ROYAL MOTORS — Admin Dashboard

A private, mobile-friendly admin console for ROYAL MOTORS (Tanzania). Admins
use it to manage car listings, prices, photos, and customers. It is a
**separate project** from the customer website (https://royal-motor.netlify.app/)
and never deploys to or modifies it.

## What's live

- **Sign in** (`/`): branded admin sign-in. In preview mode, any email and a
  password of 6 or more characters open the dashboard.
- **Overview** (`/dashboard`): stock KPIs, recent cars, a status breakdown,
  and the latest leads.
- **Cars** (`/cars`): add, edit, and delete cars; upload multiple photos and
  pick the cover; set a price or "Ask for Price"; set the status and the
  featured flag.
- **Customers** (`/customers`): track leads and buyers, filter by status,
  reply on WhatsApp, and add, edit, or delete customers.

The dashboard currently runs on realistic sample data (`src/lib/fixtures.ts`).
Changes stay in memory and reset on reload until the Supabase connection is
added.

## Tech

- TanStack Start (React 19) with file-based routes
- Tailwind CSS v4, with the theme in `src/styles.css`
- lucide-react icons
- Netlify hosting, with the Netlify Image CDN for car photos
- Planned: Supabase (Postgres, Auth, Storage)

## Run locally

```bash
pnpm install
netlify dev        # or: pnpm dev
```

## Roadmap

See [PLAN.md](./PLAN.md):

1. Supabase data model
2. Secure admin login
3. Photo uploads to Supabase Storage
4. Customer website connection
5. Polish and operations
