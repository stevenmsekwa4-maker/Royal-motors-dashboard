# AGENTS.md — ROYAL MOTORS Admin

Private admin dashboard for ROYAL MOTORS car dealership (Tanzania).
**Continue from [PLAN.md](./PLAN.md).** Milestones 1–4 (UI, Supabase data,
admin login, photo storage) are implemented. The database side lives in
`supabase/setup.sql`, which the owner runs in the Supabase SQL Editor.

## Hard constraints from the owner

- This is a separate project from the live customer website
  https://royal-motor.netlify.app/. Never deploy to, edit, or replace that
  site from here.
- The owner's existing **Supabase** project is the chosen database. The
  customer website will later read the same tables, so keep the field names
  stable.
- Never expose the Supabase service role key to the browser. Use it only in
  server functions.

## Architecture

- `src/routes/__root.tsx`: HTML shell, metadata (`noindex`), Google Fonts
  (Cinzel and Manrope), and `InventoryProvider`.
- `src/routes/index.tsx`: Supabase email/password sign-in and forgot
  password. `src/routes/reset-password.tsx` handles the reset email link.
- `src/routes/_admin.tsx`: pathless layout (`ssr: false`) whose `beforeLoad`
  only lets in users whose `profiles.role = 'admin'`. It also mounts
  `InventoryProvider` and shows loading and connection-error states.
- `src/routes/_admin.dashboard.tsx`, `_admin.cars.tsx`,
  `_admin.customers.tsx`: the screens. The Cars and Customers screens open
  their editors through search params (`?new=true`, `?edit=<id>`), so links
  from Overview deep-link into an editor.
- `src/components/AdminShell.tsx`: desktop sidebar and mobile top bar plus
  bottom tab bar.
- `src/components/CarEditor.tsx`: car form. New photos stay local until
  save, then upload to the `car-photos` bucket (`src/lib/photos.ts`).
- `src/components/CustomerEditor.tsx`: customer form.
- `src/components/ui.tsx`: Logo, Pill, Sheet (drawer or bottom sheet),
  ConfirmDialog, Toast, PageHeader, and Initials.
- `src/lib/types.ts`: the domain model (Car, Customer). Mirror it in the
  Supabase schema.
- `src/lib/supabase.ts`: browser client (anon key only) and
  `describeError()` for clear error messages. `src/lib/auth.ts`: admin
  checks. `src/lib/db.ts`: maps between the domain model and the live column
  names (`mileage`, `fuel_type`, `image_url` = cover, `customers.full_name`).
- `src/lib/store.tsx`: `useInventory()` backed by Supabase. Actions are async
  and throw readable errors. There is no sample-data fallback.
- `src/lib/format.ts`: TSh formatting, status colours, WhatsApp links, and
  `photoSrc()`, which routes `/…` paths through the Netlify Image CDN.
- `public/img/`: sample car photos (AI-generated showroom shots).

## Conventions

- Prices are integer TSh. `price: null` means "Ask for Price / Ulizia Bei",
  which matches the customer website.
- Car status is `draft` (private), `available`, `reserved`, or `sold`. Only
  `available` and `reserved` are meant for the public website.
- Styling uses Tailwind v4 with theme tokens in `src/styles.css`: `ink-*`
  (navy/black), `gold-*`, and `paper`. Use the reusable `.field`, `.label`,
  `.btn-gold`, `.btn-ghost`, and `.card` classes.
- Every screen must work on mobile. The bottom nav takes about 80px, so main
  content has `pb-28` below `lg`.
- Security relies on RLS. Never add the service role key to this app.
