# Groomee — Platform Implementation Plan

> **North Star:** The branded landing page (`groomee_branded (3).html`)
> **Brand voice:** Urgency with dignity. Beauty access for women, anytime. Dignified work for beauty professionals.

---

## Terminology Guide

| ❌ Old (deprecated) | ✅ New (use everywhere) |
|---------------------|------------------------|
| Groomer | Beauty professional / Pro / Vendor |
| Groomers | Beauty professionals / Pros / Vendors |
| Groomer Squad | My Pros / Favourite Pros |
| groomerId | proId |
| groomerEarning | proEarning |
| Find a groomer | Find a beauty pro |
| Grooming | Beauty (services) |

---

## Phase 1: Terminology + Copy Alignment (Week 1)

### 1A. Prisma Schema Rename
Use `@@map()` to keep database tables unchanged — zero migration needed.

- `Groomer` → `Pro` (keep `@@map("groomers")`)
- `GroomerService` → `ProService`
- `GroomerStatus` → `ProStatus`
- `GroomerAvail` → `ProAvail`
- `favouriteGroomer` → `favouritePro`
- All relation fields: `booking.groomer` → `booking.pro`, etc.
- Run `prisma generate`

### 1B. Codebase-Wide Rename (~72 files, 755+ references)

**Types:** `src/types/index.ts` — all type exports
**Lib files:** `dispatch.ts`, `whatsapp.ts`, `surcharge.ts`, `utils.ts`, `data.ts`, `auto-confirm.ts`
**Components (rename files + content):**
- `TopGroomers.tsx` → `TopPros.tsx`
- `GroomerCard.tsx` → `ProCard.tsx`
- `GroomerGrid.tsx` → `ProGrid.tsx`
- `GroomerProfile.tsx` → `ProProfile.tsx`
- `GroomerProfileView.tsx` → `ProProfileView.tsx`

**Routes (add redirects from old paths):**
- `/groomer/[slug]` → `/pro/[slug]`
- `/api/groomers` → `/api/pros`
- `/admin/groomers` → `/admin/pros`

**UI Copy updates (matching landing page north star):**
- Hero: "Your beauty pro, at your door, right now."
- Stats: "50+ Vetted pros"
- Search: "Find a beauty pro near you"
- Trust: "All pros vetted & ID-verified"
- Status labels: "Finding your pro…", "Pro assigned", "Pro arrived"
- Dispute: "Pro did not show up", "Pro was unprofessional"
- Beauty profile: "This profile is shared with every pro you book"

### 1C. Landing Page Integration into Next.js

New components to match the HTML north star:
1. `CityRolloutBanner.tsx` — Lagos live / Abuja coming soon
2. `SurveySection.tsx` — Customer + Vendor survey cards with Groomee Points
3. `SurveyModal.tsx` — 5-question multi-step modal
4. `AboutSection.tsx` — Mission, values, founder quote
5. `AbujaWaitlist.tsx` — Waitlist form with area selector
6. `Footer.tsx` — Full footer matching landing page

New API routes:
- `POST /api/surveys` — Submit survey responses
- `POST /api/waitlist` — Abuja waitlist signup

New Prisma models: `SurveyResponse`, `Waitlist`

Homepage order: Hero → TrustBadges → CityRolloutBanner → ServiceCategories → TopPros → HowItWorks → SurveySection → AboutSection → AbujaWaitlist → Footer

---

## Phase 2: Customer Booking Flow (Week 2-3)

### 2A. Enhanced Search
- Service category filter tabs
- Lagos zone/area selector
- Rating, price, availability filters
- Sort options

### 2B. Booking Creation Wizard
- Step 1: Service selection
- Step 2: Date/time (calendar + ASAP toggle)
- Step 3: Location (address + area)
- Step 4: Notes + beauty profile
- Step 5: Price breakdown + Paystack payment

### 2C. Booking Status Tracking
- Visual timeline: Pending → Dispatching → Accepted → En Route → Arrived → In Service → Completed → Confirmed
- Pro info card when assigned
- Action buttons (cancel, confirm, review)

### 2D. Review System
- Star rating + tags (On time, Professional, Great results, Friendly)
- Text review

---

## Phase 3: Vendor/Partner Portal (Week 3-5)

### The Vendor Value Proposition

The portal must answer: **"I'm an established beauty business. Why should I use Groomee?"**

It's not just customer acquisition. The value prop is **a complete business operating system**:

**1. Predictable, Consistent Income**
- Groomee aggregates demand — pros don't have to chase clients
- Transparent pricing frameworks eliminate undercharging and negotiation
- Recurring bookings via customer subscriptions (Groomee Pass)
- "Favourite Pros" feature means loyal customers come back to you

**2. Business Management Tools (Free)**
- Booking calendar and scheduling
- Earnings dashboard with real-time tracking
- Automated payout to bank account (weekly/bi-weekly)
- Customer analytics (repeat rate, avg rating, peak hours)
- Digital portfolio and verified profile

**3. Professional Growth Path**
- Tier system: Standard → Pro → Elite with increasing benefits
- Training resources and quality standards
- Higher urgency fee splits at higher tiers
- Corporate/event job access for Elite pros
- Performance-based visibility boosts in search

**4. Financial Safety Net**
- Advance/float system for emergencies
- Base insurance coverage (Standard tier+)
- Structured contracts and clear cancellation policies
- No hidden platform fees — transparent split

**5. Dignity and Protection**
- ID-verified customers
- Dispute resolution system
- Strike system protects good pros from bad actors
- Community standards that value the professional's craft

**6. Reduced Operating Costs**
- No need for salon rent — work mobile
- No social media marketing costs — Groomee markets for you
- No payment collection headaches — Paystack handles it
- WhatsApp + web portal for flexible management

### 3A. Vendor Auth
- Add `"PRO"` role to session system
- Link Pro records to User accounts via `userId`
- Same phone+OTP login flow

### 3B. Portal Layout (`/partner/*`)
- `PartnerSidebar.tsx` — Dashboard, Bookings, Earnings, Schedule, Profile, Growth, Settings
- `PartnerBottomNav.tsx` — Mobile tab nav
- Glassmorphism design matching brand

### 3C. Vendor Dashboard
- Today's bookings
- Online/Offline toggle
- Weekly/monthly earnings chart
- Rating summary
- Tier progress indicator
- Quick stats: acceptance rate, completion rate, repeat customer rate

### 3D. Bookings Management
- Upcoming / Active / Completed tabs
- Status update buttons (mirrors WhatsApp: On My Way → Arrived → Done)
- Customer info (masked for privacy)
- Earnings per booking

### 3E. Earnings & Payouts
- Total earned, pending, paid out
- Per-booking breakdown
- Payout history with dates
- Bank details management
- Advance/float request (if eligible)

### 3F. Schedule Management
- Weekly availability calendar
- Set hours per day
- Block dates (vacation, personal)
- Online/offline quick toggle

### 3G. Profile & Portfolio
- Edit name, bio, photo
- Manage services + custom pricing
- Manage zones
- Portfolio gallery (future)
- ID verification status
- Tier badge display

### 3H. Growth & Analytics
- Tier progress: current tier, next tier requirements, progress bars
- Performance metrics: acceptance rate, on-time rate, customer satisfaction
- Tips to improve ranking
- Training materials/resources
- Earnings comparison (this month vs last)

### 3I. Vendor Onboarding
- Multi-step application: Info → Services → Zones → Pricing → Bank → ID → Terms
- Pending approval state
- Admin notification for review

---

## Phase 4: Groomee Points, Surveys, Waitlist (Week 5-6)

### 4A. Points System
New model: `PointsLedger` (userId, amount, reason, referenceId, createdAt)
Add `points` field to User model.

Earning:
- Survey completion: 10 points
- Booking completion: 5 points
- Leave review: 3 points
- Join waitlist: 5 points
- Referral (future): 50 points

Redemption (future): booking discounts, priority dispatch, free Pass month

### 4B. Survey Backend
- POST /api/surveys — structured answers, points award, duplicate detection
- Admin analytics page

### 4C. Waitlist Backend
- POST /api/waitlist — email, phone, city, role (customer/pro/both)
- Admin management page with export

---

## Phase 5: Subscriptions, Real-Time, Scaling (Week 6-8)

### 5A. Groomee Pass
- Plans: Monthly ₦4,000 / Bi-annual ₦22,000 / Annual ₦40,000
- Benefits: Waived platform fee, priority dispatch, reduced urgency fees
- Auto-renewal via Paystack authorization
- Usage tracking

### 5B. Real-Time Tracking
- MVP: Polling every 10s on active booking page
- Future: Server-Sent Events
- WhatsApp remains primary notification channel

### 5C. Multi-City (Abuja)
- Zone model already has `city` field
- Add city selector to search
- Feature flags per city
- Waitlist → launch conversion flow

### 5D. Analytics Dashboard (Admin)
- Revenue charts, booking trends
- Pro performance leaderboard
- Survey analytics
- Waitlist metrics

---

## UI Design System

**Glassmorphism principles (from globals.css and landing page):**
- Cards: `bg-white/85 backdrop-blur-xl border border-white/20 rounded-2xl shadow-lg`
- Overlays: `bg-brand-deep/70 backdrop-blur-md`
- Pills/badges: `bg-white/10 border border-white/20 backdrop-blur-sm`
- Dark sections: `bg-brand-deep` with radial gradient overlays

**Brand colors:**
- Brand green: `#53eb64`
- Brand deep teal: `#014342`
- Brand yellow: `#fffea1`
- Gold: `#c8871a`
- Abuja purple: `#7c3aed`
- Cream bg: `#f7f5f0`

**Typography:**
- Display: Playfair Display (serif) — headlines
- Body: DM Sans (sans) — everything else
- Mono: DM Mono — numbers, prices, stats

---

## Risk Areas

1. **Schema rename**: Using `@map()` keeps DB unchanged. Zero migration risk.
2. **WhatsApp templates**: Twilio requires pre-approved templates. Copy changes need re-approval.
3. **Vendor adoption**: Portal must deliver genuine value beyond "more customers" — focus on business tools, financial safety, and professional dignity.
4. **Points economy**: Build the ledger first, tune values with real data.
5. **Real-time**: Polling is fine for MVP. SSE when >100 concurrent active bookings.
