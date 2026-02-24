# Groomee — On-demand Grooming PWA

> Professional grooming delivered to your door in Lagos. Available 24/7.

Built with Next.js 14 (App Router), Tailwind CSS, Prisma/PostgreSQL, Paystack payments, Termii WhatsApp dispatch. PWA-ready.

## Tech Stack

|               |                                       |
| ------------- | ------------------------------------- |
| Framework     | Next.js 14 App Router                 |
| Styling       | Tailwind CSS + custom design tokens   |
| Database      | PostgreSQL via Prisma                 |
| Auth          | Phone OTP (Termii/SMS) + JWT sessions |
| Payments      | Paystack (authorise → hold → capture) |
| Notifications | WhatsApp + SMS via Termii             |
| Deployment    | Vercel + Supabase/Neon                |

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in DATABASE_URL, JWT_SECRET, PAYSTACK_SECRET_KEY, TERMII_API_KEY

# 3. Setup DB
npm run db:push
npm run db:seed   # optional — seeds services, zones, settings

# 4. Dev server
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import at vercel.com/new
3. Add all env vars from `.env.example`
4. Deploy

See `.env.example` for all required variables.

## Project Structure

```
src/
├── app/
│   ├── (customer)/     # Customer-facing pages
│   │   ├── page.tsx    # Homepage
│   │   ├── search/     # Groomer discovery
│   │   ├── groomer/    # Groomer profile + booking
│   │   ├── booking/    # Live tracking
│   │   ├── bookings/   # History
│   │   ├── profile/    # Account
│   │   └── auth/       # Phone OTP login
│   ├── (admin)/        # Admin dashboard
│   │   └── admin/      # Ops, bookings, groomers, disputes, payouts
│   └── api/            # REST API + webhooks
├── components/         # UI components
├── lib/                # Utils, data, db, auth
└── prisma/             # Schema + seed
```

## PWA

- `public/manifest.json` — App manifest
- `public/sw.js` — Service worker (offline cache)
- Install prompt shown after 2nd visit
- Theme colour: #1A3A2A (forest green)

## WhatsApp Commands (Groomers)

| Command      | Action              |
| ------------ | ------------------- |
| `ON` / `OFF` | Toggle availability |
| `YES` / `NO` | Accept/decline job  |
| `OTWAY`      | On the way          |
| `ARRIVED`    | Arrived at location |
| `DONE`       | Service complete    |
| `BALANCE`    | Check earnings      |
# groomee
