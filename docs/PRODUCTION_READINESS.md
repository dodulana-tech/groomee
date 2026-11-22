# Groomee Production Readiness

Owner: Kiitan (ops lead). Technical appendix at the bottom is for whoever has Render / GitHub access.
Production site: **https://groomeeapp.com** (www redirects to the apex). WhatsApp line: **+234 808 429 6023**.

---

## Part 1: Go-live checklist (plain English)

Work top to bottom. Tick each box only when you have checked it yourself.

### A. Must be done before real customers pay (blockers)

1. [ ] **Turn on a database backup and test a restore.** In Render, open the `groomee-db` database, look for the "Backups" / "Recovery" (point-in-time recovery) tab. Write down what the starter plan offers (how many days of backups, whether PITR is on). If there is no automatic backup, ask the tech lead to upgrade the plan or to set up a daily export *before* anything else on this list. Then click "Export" (or ask for a manual backup) and keep the file.
2. [ ] **Switch Paystack from test to live.** In Render, `groomee` service, Environment: `PAYSTACK_SECRET_KEY` must start with `sk_live_`, not `sk_test_`. In the Paystack dashboard (Settings, API Keys & Webhooks, *Live* tab) set the webhook URL to `https://groomeeapp.com/api/webhooks/paystack`. Set `PAYSTACK_WEBHOOK_SECRET` to the same live secret key (Paystack signs webhooks with it).
3. [ ] **Make the site address correct.** `NEXT_PUBLIC_APP_URL` must be exactly `https://groomeeapp.com` (no trailing slash, not groomee.ng, not localhost). If it is wrong, customers are sent to a dead page after paying. After changing it you must redeploy (it is baked in at build time).
4. [ ] **Switch Lagos to LIVE.** Admin, Cities. The live homepage currently shows no LIVE city, which means nobody can book. Set Lagos to LIVE (leave Abuja on WAITLIST until pros are onboarded).
5. [ ] **Clear out demo data.** The demo pros (Chidinma Adeyemi, Shade Martins, etc.), test services (`abuja-test-*`) and test bookings must go before launch, or customers will book people who do not exist. The tech lead runs `npm run purge:demo` (see Appendix C). First run is a dry run that only lists what would be deleted. Read that list with the tech lead before anything is deleted.
6. [ ] **Real beauty professionals are live.** After the purge, check Admin, Pros: at least a handful of vetted, ACTIVE pros in each Lagos zone with services and working hours set. If there are none, customers will see "no pro available".
7. [ ] **SMS / WhatsApp codes actually arrive.** Log in on the live site with a Nigerian MTN, Airtel and Glo number, including a number that has DND (Do Not Disturb) switched on. Each must receive the login code within 1 minute. If DND numbers do not get it, see Appendix E.
8. [ ] **WhatsApp sender is the real Groomee number, not the Twilio sandbox.** `TWILIO_WHATSAPP_NUMBER` must be set to the approved Groomee WhatsApp Business sender. If it is empty, messages go out from the Twilio test number and real customers will not get them.
9. [ ] **Admin access is locked to the team.** `ADMIN_PHONES` and `ADMIN_EMAILS` list only current team members (comma-separated). Remove anyone who has left. In Admin, Team, check every admin and their role.
10. [ ] **Email works.** `SMTP_HOST=smtp.zoho.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (a Zoho app password), `SMTP_FROM` (for example `Groomee <hello@groomeeapp.com>`). Trigger a test (e.g. weekly report or an email login code) and confirm it arrives and is not in spam.

### B. Before launch day

11. [ ] **Uptime alert.** Sign up for a free uptime monitor (UptimeRobot, Better Stack). Monitor `https://groomeeapp.com/api/health` every 5 minutes; it should say `"status":"ok"`. Send alerts to Kiitan's phone and email.
12. [ ] **Domain check.** `https://www.groomeeapp.com` should land on `https://groomeeapp.com`. The padlock must show in the browser. `http://` must redirect to `https://`.
13. [ ] **Scheduled jobs are running.** In Render, the cron jobs `groomee-tick` (every 10 min), `groomee-renew-subs` (daily), `groomee-benefits` (daily), `groomee-weekly-report` (Mondays) should show recent successful runs.
14. [ ] **Support number.** `ADMIN_SUPPORT_PHONE` is the number pros are told to call for urgent issues. Set it to a phone someone answers.
15. [ ] **Do a real paid booking end to end** with a team member as customer and a real pro: book, pay with a real card (small amount), pro accepts, arrives, completes, customer confirms, then refund it from Admin. Check the payment shows in the Paystack live dashboard.
16. [ ] **Error alerts.** Ask the tech lead to turn on Render log alerts (or connect a log tool) so a spike of errors notifies someone. Today errors only appear in the Render log stream.

### C. Launch day runbook

1. Announce a 30-minute quiet window to the team (no admin edits).
2. Take a manual database backup in Render (or confirm the latest automatic one is from today). Write down the time.
3. Tech lead runs the demo-data purge dry run, reviews it with you, then runs it for real. Keep the backup file it writes.
4. Confirm environment variables (A2, A3, A8, A9, A10) once more. Redeploy if any changed.
5. Admin, Cities: Lagos = LIVE.
6. Open the site on a phone (4G, not office Wi-Fi). Log in, browse services, see real pros.
7. Do the real paid test booking (B15) and refund it.
8. Check `/api/health` and the uptime monitor show green.
9. Go live with marketing.

### D. Rollback (if something goes badly wrong)

* **Bad code deploy:** Render, `groomee` service, Deploys, pick the last good deploy, "Rollback". Takes a few minutes; data is not affected.
* **Data deleted by mistake by the purge:** the purge writes a JSON backup of every row it deleted. The tech lead can re-insert from it. For a large mistake, restore the database from the backup taken in step C2 (Render, `groomee-db`, Recovery). A restore loses anything that happened after the backup time, so pause bookings first (set Lagos back to WAITLIST).
* **Payments misbehaving:** set Lagos to WAITLIST in Admin, Cities (stops new bookings), then investigate. Refunds can be done from the Paystack dashboard.
* **Messages not arriving:** customers can still be reached on the WhatsApp line +234 808 429 6023 by the team manually.

---

## Part 2: Technical appendix

### A. Environment variables

"Declared" = present in `render.yaml` (values with `sync: false` must be typed into the Render dashboard; render.yaml only reserves the name).

| Variable | Required? | Declared in render.yaml | What breaks if missing / wrong |
|---|---|---|---|
| `DATABASE_URL` | Required | yes (from `groomee-db`) | App does not boot (`src/lib/env.ts` throws). |
| `NODE_ENV` | Required | yes (`production`) | In `development`, OTP codes are logged instead of sent (`api/auth/send-otp`, `send-email-otp`); Twilio webhook signature check is skipped. |
| `JWT_SECRET` | Required | yes | App does not boot; all sessions invalid if rotated. Use 64+ random chars. |
| `PAYSTACK_SECRET_KEY` | Required | yes | App does not boot. `sk_test_` = no real money (env.ts now warns). Also used for bank verification and subscription renewal. |
| `PAYSTACK_WEBHOOK_SECRET` | Recommended | yes | Webhook signature check. Now falls back to `PAYSTACK_SECRET_KEY` (previously threw a 500 on every webhook if unset). Set it to the live secret key. |
| `NEXT_PUBLIC_APP_URL` | Required | yes | Must be `https://groomeeapp.com`. Inlined at **build** time; redeploy after changing. Paystack callback URLs fall back to `http://localhost:3000` (bookings, payment-url, payments/verify, subscriptions), links in messages/emails fall back to `groomee.ng`. |
| `NEXT_PUBLIC_GROOMEE_WHATSAPP` | Optional | yes (`2348084296023`) | Falls back to the same number. Build-time. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Required for OTP | yes | No SMS/WhatsApp at all: customers cannot log in by phone. Auth token also verifies the inbound WhatsApp webhook. |
| `TWILIO_PHONE_NUMBER` | Required for SMS OTP | yes | SMS sends fail. Must be a sender allowed to reach Nigerian numbers (see E). |
| `TWILIO_WHATSAPP_NUMBER` | Required for WhatsApp | yes | Falls back to the **Twilio sandbox** `+14155238886`; real customers get nothing. env.ts now warns. |
| `SMTP_HOST` | Optional | yes | Defaults to `smtp.zoho.com`. |
| `SMTP_PORT` | Optional | **added** | Defaults to 465 (TLS). Use 587 only with STARTTLS. |
| `SMTP_USER` / `SMTP_PASS` | Required for email | yes | Emails silently skipped (warn log). Use a Zoho app-specific password. |
| `SMTP_FROM` | Recommended | **added** | Falls back to `SMTP_USER`, then `noreply@groomee.ng` (dead domain). |
| `ADMIN_PHONES` | Required | yes | Bootstrap admins by phone; advance-request alerts; weekly report WhatsApp. Comma-separated E.164. |
| `ADMIN_EMAILS` | Required | yes | Bootstrap admins by email; weekly report recipients. `ADMIN_EMAIL` (singular) is also read as a legacy alias. |
| `ADMIN_DEFAULT_ROLE` | Optional | no | Role slug for env-bootstrapped admins; default `super-admin`. |
| `ADMIN_SUPPORT_PHONE` | Recommended | **added** | Shown to pros in the WhatsApp HELP menu. Previously fell back to a fake `07000000000`; now falls back to `+2348084296023`. |
| `CRON_SECRET` | Required | yes (generated, shared to crons) | All `/api/cron/*` return 401; dispatch timeouts, auto-confirm, subscription renewal, benefits, weekly report stop. |
| `SESSION_DURATION` | Optional | no | Seconds, default 2592000 (30 days). |
| `DISPATCH_TIMEOUT_SECONDS` | Optional | no | Default 180. |
| `ANTHROPIC_*` | n/a | n/a | Not read by this branch. If the AI-concierge branch is merged, declare its keys then. |
| `BASE_URL`, `CONFIRM_DB_HOST`, `PURGE_KEEP_PHONES` | Scripts only | no | Used by `smoke:admin` / `purge:demo`; never needed on Render. |

### B. Schema changes: `prisma db push --accept-data-loss`

**Risk:** the build ran `prisma db push --accept-data-loss` on every deploy. Any schema difference that Prisma considers lossy (a removed model or field, a narrowed type, a new unique constraint over duplicate rows) was applied silently, deleting production data with no backup and no review. Deploying an older branch, or a branch that lacks a model another branch added, would drop that table.

**Change made (render.yaml):** dropped `--accept-data-loss`. Additive changes (new tables, new nullable or defaulted columns, new indexes) still apply automatically. A lossy change now fails the build with Prisma's data-loss warning, and the previous deploy keeps serving traffic.

**Trade-off:** a deliberate destructive change now needs a human step: take a backup, then run `npx prisma db push --accept-data-loss` once from a shell with the production `DATABASE_URL` (Render shell), then redeploy. That is slower, but the decision is now made on purpose. The long-term fix is `prisma migrate` (versioned SQL migrations, `prisma migrate deploy` in the build); that needs a baseline migration made against the current production schema and is a larger piece of work.

**Check before the first deploy with this change:** confirm the production schema already matches this branch's `schema.prisma` (it should if the last deploy came from the same lineage). If it does not, the build fails and shows exactly what would have been dropped. That is the point of the change, but plan for it.

### C. Demo-data purge (`npm run purge:demo`)

Script: `scripts/purge-demo-data.ts`. It runs from the same commit as the deploy (it uses that commit's Prisma schema).

What it treats as demo data:
* Pros/users with phones starting `+2348011111` (seed pros), `+23499` (deep-test), `+234809999991` (test-scheduler), `+234800000` (placeholder), or exactly `+2348011112222`; pros/users whose name contains the word "test"; users linked to a demo pro and pros linked to a demo user; stale temp users (no phone, no name, more than 24h old, owning nothing).
* Services whose slug or name contains the word "test" (`abuja-test-*`).
* Bookings with a demo customer, demo pro, test service (primary or extra), `TEST-` reference, or a demo apprenticeship.
* Everything that hangs off those rows, notes and audit logs about them, notifications to their phones, every expired OTP code, and SMS/WhatsApp notification rows sent to malformed `+234` numbers.

Never touched: ADMIN users, users with an admin role, anyone in `ADMIN_PHONES` / `ADMIN_EMAILS`, cities, zones, zone travel, the rest of the service catalogue, settings, subscription and benefit plans, products, admin roles.

Safety:
* Dry run by default: per-table counts (would delete / total), sample rows with the reason each one was flagged, side effects on rows that are kept (FK set to NULL), warnings.
* `--execute` also needs the DB host typed in at the prompt, or `CONFIRM_DB_HOST=<host>`. A non-TTY run without it aborts.
* Refuses to run with `NODE_ENV=production` unless `--i-know-this-is-production` is also passed (Render shells have NODE_ENV=production).
* **Real-money guard:** if a booking paid (AUTHORISED/CAPTURED/REFUNDED) by a non-demo, non-admin customer, or a paid earning of a non-demo pro, would be deleted, the run aborts. Reconcile those in Paystack first, then pass `--allow-real-money-impact`, or exclude people with `--keep-phones=+234...,+234...`.
* Re-plans inside a single REPEATABLE READ transaction, writes a JSON backup (fsynced) of every row to delete to `./backups/` (gitignored: it contains PII), then deletes child tables first, by id. Any failure rolls everything back.
* `--no-name-markers` turns off the "test in the name" rule if the dry run flags a real person.

Production procedure: Render, `groomee` service, Shell:
```
npm run purge:demo -- --i-know-this-is-production            # dry run, review output
CONFIRM_DB_HOST=<host shown in banner> npm run purge:demo -- --execute --i-know-this-is-production
```
Copy the backup JSON off the instance straight away (the Render disk is temporary), and store it somewhere private.

### D. Backups, monitoring, logging

* **Backups:** check in the Render dashboard, `groomee-db`, what the current plan includes (daily snapshots, retention, point-in-time recovery). Do not assume the starter plan has PITR. If it does not, either upgrade the plan or schedule a daily `pg_dump` to off-site storage. Test a restore into a scratch database once.
* **Health:** `/api/health` runs `SELECT 1` and returns 503 if the DB is down. Render already uses it as `healthCheckPath` (bad deploys do not go live). Add an external uptime monitor on it (checklist B11).
* **Errors:** the app logs with `console.error` only; there is no error tracker. Minimum: Render log alerts or a log drain (Better Stack / Datadog). Recommended next step: Sentry for Next.js (needs a DSN env var and a small code change; not done here).
* **Cron visibility:** cron jobs `curl -s` the endpoints and always exit 0, so a 401/500 looks like success in Render. Consider `curl -fsS` so failures show as failed runs (small render.yaml change; left for review because it changes cron behaviour).

### E. SMS / WhatsApp readiness for Nigeria

* OTP is sent on **both** WhatsApp and SMS for every login (`notifyCustomerOtp`).
* **SMS:** Nigerian networks block promotional traffic to DND numbers. OTPs must go out on a **transactional / registered sender ID** route. With Twilio, register an alphanumeric sender ID for Nigeria (allow 1 to 3 weeks) or use a Nigerian provider with a DND-exempt OTP route (Termii, for example). Test with a DND-enabled line (checklist A7).
* **WhatsApp:** the sender must be an approved WhatsApp Business sender on Twilio. Booking updates sent outside the 24-hour customer window need **approved message templates**; free-form messages will be rejected. Make sure the inbound webhook in Twilio points at `https://groomeeapp.com/api/webhooks/whatsapp`.

### F. Domain

* Apex `groomeeapp.com` and `www` are both custom domains on the Render web service, with www redirecting to the apex. Confirm both certificates are issued (Render, Settings, Custom Domains).
* `groomee.ng` is dead but still used as a fallback in code. That is being fixed separately. Current locations: `src/app/opengraph-image.tsx:68`, `src/app/layout.tsx:72,105,109`, `src/app/(customer)/page.tsx:83-85`, `src/app/(customer)/install/page.tsx:15,42`, `src/app/(customer)/profile/page.tsx:54`, `src/app/(admin-auth)/admin/login/page.tsx:215`, `src/app/cert/[code]/page.tsx:14,122,522`, `src/app/api/waitlist/route.ts:54`, `src/app/api/pro/advance/route.ts:114`, `src/app/api/admin/team/route.ts:156`, `src/app/api/partner/apprentices/invite/route.ts:190`, `src/app/api/partner/apprentices/[id]/freedom/route.ts:15`, `src/app/api/profile/referral/route.ts:26`, `src/app/(admin)/admin/team/page.tsx:688`, `src/lib/email-notify.ts:24`, `src/lib/email.ts:16`, `src/lib/whatsapp.ts:243,267,287`, `src/lib/email-templates.ts:1`, `src/lib/paystack.ts:15,16,60`.

### G. Paystack test to live

1. Paystack dashboard: complete business verification (compliance) so the live mode is enabled and settlements go to the Groomee bank account.
2. Copy the **live** secret key into `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` in Render.
3. Live webhook URL: `https://groomeeapp.com/api/webhooks/paystack`. Handled events: `charge.success`, `transfer.success`, `transfer.failed`, `refund.processed`.
4. Payouts to pros use Paystack Transfers: enable Transfers on the live account, fund the balance, and decide on OTP-for-transfers (if Paystack requires a transfer OTP, automated payouts and savings releases will stall).
5. Redeploy. Do a small real charge and refund (checklist B15).
6. Clear out test-mode artifacts: subscriptions made in test mode have `paystackAuthCode`s that do not work in live mode. The renew-subscriptions cron will fail on them; cancel those subscriptions or run the purge if they belong to demo users.

### H. Code changes in this pass

* `scripts/purge-demo-data.ts` + `npm run purge:demo`; `/backups/` gitignored.
* `render.yaml`: no `--accept-data-loss`; declared `SMTP_PORT`, `SMTP_FROM`, `ADMIN_SUPPORT_PHONE`.
* `src/lib/paystack.ts`: webhook signature falls back to `PAYSTACK_SECRET_KEY`, returns false instead of throwing when neither is set.
* `src/app/api/webhooks/whatsapp/route.ts`: support phone fallback is the Groomee line, not `07000000000`.
* `src/lib/env.ts`: production warnings for test Paystack key, sandbox WhatsApp sender, non-https app URL, missing SMTP_FROM / ADMIN_EMAILS / ADMIN_SUPPORT_PHONE.
* Removed `src/app/(customer)/booking/demo` (unlinked, public, mock booking with a fake `+2348000000000` number).

### I. Bigger items, not done here

* Move from `db push` to `prisma migrate` with a production baseline.
* Error tracking (Sentry) and failing cron exit codes.
* `localhost:3000` fallbacks for Paystack callback URLs should fail loudly in production instead (same owner as the groomee.ng fallback work).
* SMS sender ID registration / DND-exempt OTP provider.
* WhatsApp template approval for booking notifications.
