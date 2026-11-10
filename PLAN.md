# ROYAL MOTORS Admin — Product Roadmap

The admin console is a **separate project** from the live customer website
(https://royal-motor.netlify.app/). Nothing in this roadmap deploys to,
edits, or replaces that site. The two meet only through the shared Supabase
database, and the website reads from it after its own connection is set up.

## Milestone 1 — Product surface ✅ (done)

- Branded admin sign-in screen (`/`)
- Overview (`/dashboard`): stock KPIs, recently updated cars, status
  breakdown, latest leads, customer-website panel
- Cars (`/cars`): search and filters, add/edit drawer with multi-photo
  upload (drag and drop, cover photo, remove), price or "Ask for Price",
  specs, status (draft / available / reserved / sold), featured flag,
  quick status change, and delete with confirmation
- Customers (`/customers`): pipeline filters, desktop table and mobile cards,
  add/edit drawer, one-tap WhatsApp, and delete
- Responsive shell: sidebar on desktop, bottom tab bar on mobile
- (Sample fixtures were removed in Milestone 2; all data now comes from Supabase.)

## Milestone 2 — Supabase data model ✅ (implemented — run `supabase/setup.sql`)

- Connect the existing Supabase project with environment variables
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` (public), plus
  `SUPABASE_SERVICE_ROLE_KEY` (server only, never sent to the browser)
- Tables, matching `src/lib/types.ts`:
  - `cars`: make, model, year, price (nullable = Ask for Price), condition,
    body_type, mileage_km, engine, fuel, transmission, colour, status,
    featured, description, timestamps
  - Photos: implemented as a `cars.photos` text[] of public URLs (index 0 =
    cover, mirrored to `cars.image_url`) instead of a separate `car_photos` table
  - `customers`: name, phone, email, source, status, interested_car_id,
    request, budget, notes, created_at
- Row Level Security:
  - The public (anon) role can read `cars`/`car_photos` only where status is
    `available` or `reserved`
  - Only admins can write
  - `customers` is admin-only
- Add a public view `public_cars` with exactly the fields the customer
  website needs
- Swap the in-memory actions in `src/lib/store.tsx` for TanStack Start server
  functions or the Supabase client behind the same `useInventory()` API

## Milestone 3 — Secure admin login ✅ (implemented — run `supabase/setup.sql`)

- Use Supabase Auth (email and password) for admin accounts, with an
  `is_admin` claim or `admins` table that the RLS policies check
- Add a `beforeLoad` guard on the `/_admin` layout route that redirects
  signed-out visitors to `/`
- Replace the preview sign-in on `/` with real auth, plus password reset and
  sign-out
- Keep the site `noindex` and consider Netlify password protection as an
  extra outer layer

## Milestone 4 — Photo uploads to Supabase Storage ✅ (implemented — run `supabase/setup.sql`)

- Create a `car-photos` bucket with public read and admin-only write
- Compress and resize images in the browser before upload, upload them
  through signed upload URLs, and save the paths in `car_photos`
- Support reordering, cover selection, and deleting files from storage when
  a photo or car is removed
- Add the Supabase storage domain to the Netlify Image CDN remote images
  allowlist for fast thumbnails

## Milestone 5 — Customer website connection (done in the website project, when you're ready)

- In the existing website project, add a read-only Supabase query against
  `public_cars` using the anon key, and render the same card and detail
  pop-up fields it already shows (make, model, year, mileage, engine, fuel,
  transmission, colour, condition, price, photos)
- Keep its design and filters (All / Brand New / Used) unchanged
- Publish only after you review it. This step is never deployed from this
  project.

## Milestone 6 — Polish and operations

- Capture website enquiries and sourcing requests straight into `customers`
- Add an activity log (who changed which price and when), CSV export, and
  sold-car history
- Add bilingual (English / Swahili) labels in the admin
