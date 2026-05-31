# [LAUNCH-01] Waitlist Landing Page + Live Founder Tier

**Parent:** [Launch Backlog](./README.md) • [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Phase:** 1 — Pre-launch waitlist & founding-member capture
**Status:** ✅ Shipped to production. Real-money flow verified end-to-end. Two stop-ship items remain before public traffic (see "Remaining" below).
**Production URL:** https://bassicology.com
**Blocks:** YouTube channel launch. The video links can now safely point to `bassicology.com`; both the email waitlist and the founder checkout work under real load.
**Depends on:** [LAUNCH-02.5d](./LAUNCH-02.5d-waitlist-embed-swap.md) — the placeholder Groove Card mockup on the waitlist must be swapped for the real interactive card before YouTube traffic hits the page. 02.5d is the specific sub-story that closes this stop-ship; the other 02.5 sub-stories are transitive predecessors (02.5d depends on 02.5c → 02.5b → 02.5a).

---

## Story

- As a **viewer who just watched the first weekly Bassicology YouTube video**
- I want to **see what Bassicology is, leave my email, and (if I'm hooked) lock founding access**
- so that **I get early access at launch and, optionally, lifetime membership at a founder price**

And:

- As **Marek launching the YouTube channel**
- I need **a working page behind every "link in description" CTA from day one** that does three jobs: capture an email, telegraph the product visually, and offer founders a path to commit financially
- so that **we capture both the wide audience AND the highest-intent supporters during the pre-launch window**

## Background / Context

The YouTube channel opens with one weekly groove video. The funnel-aligned platform is still being built (LAUNCH-02 through LAUNCH-08). The waitlist page is the single destination for every link in description: it introduces the product, captures interest, and offers a real $397 commitment path for the most engaged viewers.

The page replaces the homepage at `/`. The previous full landing is preserved at `/preview` for stakeholder review and future use. Three sub-flows live here:

1. **Email signup** — the primary conversion. Captures `email + level`.
2. **Founder upsell** — shown after a successful signup. Opens the live Stripe Payment Link for $397 lifetime founding access. Records click intent independently of payment completion.
3. **Final confirmation** — for visitors who skip the upsell (or who paid and came back).

Behind the scenes, a Stripe webhook → NestJS handler → Supabase write → Resend send pipeline fires when a founder actually pays, producing a real-time welcome email branded to match the page.

The visual scope expanded beyond the original "doorbell only" framing because the page is doing strategic work: it's the visual introduction to the platform, the only place the product story lives until LAUNCH-09 (open day). **The Groove Card on the page is currently a visual mockup. It must be replaced by the real interactive component before any real YouTube traffic hits the page.** A dev-only `Preview` chip on the card auto-hides in production, so there's no remaining visible reminder once deployed — treat the placeholder as a hard stop-ship signal in PR review.

## Requirements

### Functional — Page

- **Route:** `/` (the homepage). Old marketing landing moved to `/preview`.
- **Page sections, in order** (founder quote was moved below the form during the May 2026 copy pass — it now closes the page as a sign-off voice rather than sitting mid-page):
  1. **Nav** — logo + "Pre-launch" chip + "Get early access" CTA that smooth-scrolls (`scrollIntoView({ behavior: 'smooth' })`) to the form. Smooth-scroll respects `prefers-reduced-motion` and falls back to instant scroll there.
  2. **Hero block** (single visual unit): pulsing "Opening soon · 2026" eyebrow → headline ("Stop watching bass. Start playing it.") → sub-paragraph ("Every other platform hands you a video to watch. **Bassicology hands you a band.** Real groove, real drummer — slow it down, change the key, mute the bass and play it yourself. **Here's a taste. Try it.**") → Groove Card mockup.
  3. **WHY section** — headline ("That's one groove. Imagine the whole library.") + three animated dial cards (TEMPO / KEY / MUTE) that visually rhyme the Groove Card's controls. Card 3 title is "Play your bass line" (the _means_ is muting; the _point_ is playing). All three cards have a fixed-height visual slot (90px, `justify-center`) so titles + bodies align horizontally across the row regardless of how tall each animation is. Key letters render at 32px (scale-125 = ~40px when active) to match Tempo's 38px bpm number proportionally.
  4. **Form** — eyebrow + headline ("First to plug in.") + subhead ("Private builds, early access, and a real say in what we ship. Before anyone else gets in.") + email field + 4-option level radio + two stacked submit buttons (see "Functional — Form" below for the intent-aware two-button pattern) + trust row.
  5. **Founder quote** — standalone italic banner attributed to mar.c, sign-off voice closing the page. **Currently commented out** in `WaitlistClient.tsx` (May 2026) so the page ends Form → Footer; restore by uncommenting the `<Reveal><FounderQuote /></Reveal>` block when ready.
- **All sections animate in** via `IntersectionObserver` (fade + 16px rise, ~800ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Honors `prefers-reduced-motion`.
- **Spacing system:** single `gap: 150px` on the page-flex container; no per-section margins.
- **Background:** dark base (`#0A0908`) + two neutral-gray radial-gradient glows (`rgba(222,222,222,0.02)` top-left, `rgba(166,166,166,0.05)` bottom-right) + a subtle SVG-noise overlay at `opacity: 0.045`. Tuned away from the previous orange-tinted radials (`rgba(242,107,29,...)`) so the orange accent only appears where it's deliberate (eyebrow, headline accent words, primary CTAs) rather than tinting the whole atmosphere. **A dev-only floating "🎨 BG TUNER" panel** (in `apps/frontend/src/shared/dev/BackgroundTuner.tsx`) is mounted at the page root, gated by `NEXT_PUBLIC_VERCEL_ENV !== 'production'`, portaled to `document.body` so `position: fixed` works regardless of ancestor containing blocks. It exposes live sliders for both radials + the noise overlay + a "Copy CSS" button so future background tweaks can be vibed locally and the values copied back into the source. The widget is currently commented out in `WaitlistClient.tsx`; restore by uncommenting the `{isDevBuild ? <BackgroundTuner .../> : null}` block.

### Functional — Form

- **Fields:** `email` (required, format-validated) + `level` (required, 4 options: `starting | returning | intermediate | advanced`) + `signupIntent` (set by the button the visitor clicks — see below).
- **Two-button submit (primary + ghost):** the form has two stacked submit buttons that both record a `waitlist` row with the visitor's email + level, but tag the row's `metadata.signupIntent` differently so we can segment the list for downstream outreach.
  - **Bright primary CTA: "Sign me up as a beta tester"** (caption: "Private builds, early access") — submits with `signupIntent: 'beta'`. Visitors who chose this self-selected as engaged: willing to receive private builds, give feedback, shape the product.
  - **Ghost button below: "Just notify me at launch"** — submits with `signupIntent: 'notify_only'`. Visitors who chose this self-selected as low-engagement: don't oversell, just tell me when it's live.
  - Both buttons advance to the founder-upsell step on success. Same destination, different bridge copy on the confirmation header above the founder card (see "Confirmation header (intent-aware)" below).
- **Submit flow:** signup → founder upsell step → final confirmation. No redirects. (Two-button choice happens at the first step; both feed into the same upsell + final-confirmation states.)
- **Confirmation header (intent-aware):** the message above the founder card on the upsell step branches by `signupIntent`. Both keep the green-check celebration icon (deliberate — both visitors crossed a real friction barrier by giving us their email; both deserve acknowledgement).
  - **Beta tester sees:** `"You're in."` + `"Beta builds go out a few at a time — yours is coming. Keep an eye on your inbox. And there's one more way to be part of this…"`
  - **Notify-only sees:** `"Got it. We'll let you know."` + `"One email when we open the doors. No spam in between. For the record — {N} people didn't wait. There's a founding offer below."` where `{N}` is the live founder count from `/api/v1/founders/count` (same value powering the progress bar — pulls from props, no extra fetch). **Floor:** if the count is under 3, falls back to `"Some people didn't wait — there's a founding offer below."` so we never render "0 people didn't wait." The seeded reserved 13 keeps us clear of this floor today, but the fallback is in place for future scenarios (e.g. if the reserved count is ever dropped).
  - **Rationale:** the two visitors made meaningfully different choices on the prior screen. Showing them identical "you're on the list, here's how to skip the line" copy is both a copy bug and a marketing bug — the notify-only person explicitly said "don't oversell me," so a hard founder pitch right after that breaks trust. The intent-aware split respects each visitor's commitment level while still bridging to the same founder offer below. Beta gets "one more way to be part of this" (deeper involvement framing); notify-only gets "{N} people didn't wait" (informational framing, low pressure).
- **Founder upsell (the card below the confirmation header):**
  - "Become a founder — $397" button records intent (POST `/api/waitlist/founder-interest`) then navigates the **current tab** to the Stripe Payment Link (`window.location.href = url`). This is the industry-standard pattern (Linear, Vercel, GitHub, Notion, Substack) — new-tab handoff was rejected because `window.close()` can't reliably close the Stripe tab, so the user would be stranded on Stripe's generic thank-you. The link URL is environment-driven via `NEXT_PUBLIC_STRIPE_FOUNDER_LINK` so staging gets the test link and production gets the live one.
  - "No thanks — just notify me when it's live" ghost button advances to final confirmation.
  - Progress bar shows the **real** founder count, fetched from the backend's `/api/v1/founders/count` endpoint on page mount. Soft-fallback to 0 if the endpoint is briefly unavailable, so the bar never flickers.
- **Honeypot:** hidden `website` field; bots filling it get a fake-success response, nothing is written.
- **Duplicate email:** returns success without leaking that the email already exists. Body copy on the confirmation branches based on the duplicate flag. (Note: the intent-aware confirmation header is _not_ re-branched for duplicates — a returning visitor who already exists still sees their chosen intent's header. Mildly off, accepted.)
- **Validation errors:** rendered inline below the field. No alert dialogs.
- **`signupIntent` validation:** the value is validated by an enum at the API edge (`waitlistEntrySchema` in `@bassnotion/contracts`, allowed values: `'beta' | 'notify_only'`). The field is **optional in the schema** so older clients (or curl/bots calling the endpoint) that don't send it still succeed — the backend defaults to `'beta'`. This is intentionally non-breaking: the field landed in production without a coordinated client/server release.

### Functional — First-touch attribution

Every signup and founder-interest click records where the visitor first
came from. This answers "which YouTube video / source drove this signup."

- **Capture moment**: page mount, in [`apps/frontend/src/shared/attribution/index.ts`](apps/frontend/src/shared/attribution/index.ts). Runs in a `useEffect` next to the scroll-restoration hook on the waitlist page.
- **What's recorded**: `utm_source / utm_medium / utm_campaign / utm_content / utm_term` from the URL, `document.referrer` (the actual upstream page — youtube.com, twitter.com, etc.), `landingPath` (which page they entered on), `Intl.DateTimeFormat().resolvedOptions().timeZone` for low-precision geo, `capturedAt` ISO timestamp.
- **Storage**: `localStorage` key `bn_attribution_v1`, 30-day TTL. First-touch model — if a record already exists within TTL, it is NOT overwritten on subsequent visits. Best-effort: storage failures (private mode, security settings) never crash the page.
- **Wire-up (waitlist + founder_interest)**: both `POST /api/waitlist` and `POST /api/waitlist/founder-interest` accept an optional `attribution` field validated by `attributionSchema` in `@bassnotion/contracts`. Server merges it into the row's `metadata` JSONB alongside `userAgent` and the request-time `referer` header.
- **Wire-up (founder_members)**: founder Stripe purchases also record attribution. The frontend packs the slim UTM context (`utm_source/medium/campaign/content/term + capturedAt`) into a base64url-encoded JSON blob and appends `?client_reference_id=attr:<encoded>` when opening the Payment Link. The webhook handler (`parseAttributionFromClientReferenceId` in `webhook.controller.ts`) decodes it back into the long-form attribution shape and merges into `founder_members.metadata.attribution`. Single-letter JSON keys + base64url keep typical payloads well under Stripe's 200-char `client_reference_id` limit; oversized blobs are silently skipped. Wider attribution (referrer, timezone, landingPath, userAgent) stays on the `waitlist`/`founder_interest` rows keyed by email — cross-reference later without spending the 200-char budget on every founder click.
- **GDPR posture (pragmatic pre-launch)**: no cookie banner. `localStorage` stays first-party, no third-party sharing, no advertising profile, no cross-site tracking. EU ePrivacy law technically applies to `localStorage` the same way as cookies, but for first-party measurement of a service the user is voluntarily engaging with, the "legitimate interest" position is defensible. **Revisit before public launch when real EU traffic arrives.**

### Functional — Founder payment pipeline

When a real founder pays, the full chain fires server-side within seconds:

```
Stripe completes checkout → POST /api/v1/webhooks/stripe (NestJS backend)
  → signature verified (rawBody preserved)
  → handleFounderCheckoutCompleted branch
  → matches by STRIPE_FOUNDER_PRICE_ID OR purchase_type=founder_membership metadata
  → parseAttributionFromClientReferenceId decodes the slim UTMs the frontend
    packed into session.client_reference_id (attr:<base64url JSON>)
  → INSERT into founder_members (idempotent on stripe_checkout_session_id);
    metadata.attribution = the decoded UTM blob if present
  → ResendService.sendFounderWelcome → HTML email to customer_details.email
  → markWelcomeEmailSent updates the row
  → returns 200 to Stripe
```

The founder branch sits BEFORE the existing auth-required code path because founder buyers are anonymous (no `user_id`) — the old "missing user_id" early-return would have silently dropped them.

### Functional — Post-payment welcome page

After paying, Stripe redirects the same tab to `https://bassicology.com/founders/welcome?session_id=cs_xxx`. This page replaces Stripe's generic thank-you so the founder lands back inside the Bassicology brand with a real celebration.

- **Route:** `/founders/welcome` ([apps/frontend/src/app/founders/welcome/page.tsx](apps/frontend/src/app/founders/welcome/page.tsx)). Public — anyone with a `session_id` can land here, which is fine because the page only renders the first name + a celebration (no PII beyond what they already paid with).
- **Success overlay (~2.6s total):** on arrival, a full-screen dark overlay covers the page with a pop-in animated green check + "PAYMENT SUCCESSFUL" label, holds for 2s, then dissolves over 600ms to reveal the welcome page. Fills the visual gap from same-tab handoff (Stripe tab disappears mid-payment so the user has no confirmation the charge landed). Overlay is gated by `?session_id=...` presence — bookmarked/direct visits skip it so the celebration doesn't feel fake.
- **Personalization:** on mount, the page calls `GET /api/v1/founders/welcome-context?session_id=cs_xxx`. The backend looks up the session via the Stripe SDK server-side (the Stripe secret key never reaches the browser), and returns `{ firstName, paid }` — `firstName` parsed from `session.customer_details.name` (first whitespace-separated token, 80-char max). Headline renders as "Welcome, [FirstName]." if resolved, otherwise just "Welcome." Sessions that aren't `payment_status === 'paid'` return `paid: false` and no name, covering bookmarked/stale/fishing requests.
- **Suspense boundary:** Next 15 requires `useSearchParams()` to be wrapped in `<Suspense>` for static prerender bailout. The default export is the Suspense wrapper; real content lives in `FoundersWelcomeContent`. Skeleton fallback is a brand-matched dark "Loading…" panel.
- **Brand match:** identical dark palette + dual-radial atmospherics + noise texture as the waitlist page so the post-payment moment doesn't feel like a different product.

### Known limitation — Czech-browser checkout phrasing

Stripe Payment Links auto-detect locale from the browser and don't accept a `locale` override (verified against Stripe docs). Czech-browser visitors see "Celkem dlužná částka" ("total amount owed") instead of "Amount due" — technically correct but tonally off-brand. Cannot be fixed without leaving Payment Links; documented as accepted until LAUNCH-03 migrates to Stripe Checkout Sessions API (see "Migrate off Stripe Payment Links" under Remaining).

### Functional — Admin funnels dashboard

A single-page dashboard at `/admin/funnels` (inside the existing `/admin` layout, gated by the existing `AdminGuard` — Bearer token → `profiles.role='admin'`) showing how the page is performing without leaving Supabase.

- **What's shown**: aggregate counts (waitlist signups, founder-button clicks, founders live, founders test), three conversion rates (waitlist→click, click→founder, waitlist→founder), top-5 UTM sources, top-5 UTM campaigns. Counts only — no PII.
- **API surface**: `GET /api/v1/founders/admin/funnels` returns the full `FunnelStats` object. Authed via the existing platform Bearer-token flow; rejects with 401 for missing/invalid tokens, 403 for valid non-admin users.
- **Implementation**: `AdminFunnelsService` runs four `count` queries in parallel against `waitlist`/`founder_interest`/`founder_members` (test + live), then pulls the `waitlist.metadata` column once and aggregates top-N UTM sources/campaigns in-process. Row counts are small (<10k expected pre-launch), so in-process grouping is simpler than the equivalent JSONB GROUP BY in SQL.
- **Nav surface**: link added at the front of the existing `/admin` top nav (Funnels • Monitoring • Tutorials • …) so it's discoverable next to the platform's other admin surfaces.
- **Scope intentionally minimal**: no charts, no date filters, no drill-down. v2 (recent-signups table) and v3 (real dashboard with time-series + filters) deferred until volume justifies them.

### Backend / Data

- **Tables (Supabase, all migrated to both staging and production):**
  - `waitlist` — `id uuid pk`, `email citext unique not null`, `level text check`, `source text default 'landing'`, `metadata jsonb`, `created_at timestamptz default now()`.
  - `founder_interest` — `id uuid pk`, `email citext not null` (NOT unique — repeat clicks signal stronger intent), `source text default 'landing'`, `metadata jsonb`, `created_at timestamptz`.
  - `founder_members` — `id uuid pk`, `email citext`, `full_name text`, `stripe_customer_id text`, `stripe_checkout_session_id text unique`, `stripe_payment_intent_id text`, `stripe_price_id text`, `amount int`, `currency text`, `mode text check ('test'|'live')`, `metadata jsonb`, `paid_at timestamptz`, `welcome_email_sent_at timestamptz`. Unique constraint on `stripe_checkout_session_id` makes the webhook idempotent on Stripe retries.
- **RLS:**
  - `waitlist`, `founder_interest`: allow anon INSERT only (no SELECT/UPDATE/DELETE policies for anon). Both have `GRANT INSERT TO anon, authenticated` paired with the policy. (Per memory: Supabase no longer auto-grants on new tables; missing this returns PG `42501` even with a permissive policy.)
  - `founder_members`: NO anon policies at all. Backend mediates all reads/writes via the service role. The public counter is served by the backend running `count(*)` server-side and returning just the integer — individual rows (containing email, name, Stripe IDs) never leave the server.
- **API endpoints:**
  - `POST /api/waitlist` (Next.js route handler) — Zod-validates body, honeypot-checks, inserts via anon Supabase key.
  - `POST /api/waitlist/founder-interest` (Next.js route handler) — Zod-validates, inserts founder_interest row via anon key.
  - `POST /api/v1/webhooks/stripe` (NestJS, in `apps/backend/src/domains/billing/webhook.controller.ts`) — verifies Stripe signature, routes founder checkouts through the new founder branch, falls through to existing platform billing flows otherwise.
  - `GET /api/v1/founders/count` (NestJS, in `apps/backend/src/domains/billing/founders.controller.ts`) — returns `{ claimed, total, error }`. Counts `mode='live'` only so test rows never inflate the public number, then adds a fixed reserved-spots floor (`FOUNDER_RESERVED_SPOTS` env var, default 13) for private-funding allocations that don't exist as `founder_members` rows. Bar starts at 13/100 today and ticks up as real public sales land — 13 private + 87 public = 100 total. Bounded by `FOUNDER_TOTAL_SPOTS` (100). Soft-fails to `{ claimed: reserved, error: 'count_unavailable' }` on Supabase issues so the page never crashes and never appears to roll back below the floor. **Admin funnels dashboard reads real counts from the table directly and is unaffected by the reserved floor — admins see truth, marketing sees floor.**
  - `GET /api/v1/founders/admin/funnels` (NestJS, same controller, `@UseGuards(AdminGuard)`) — returns the `FunnelStats` payload powering the `/admin/funnels` dashboard. Counts + conversion rates + top-N UTM sources/campaigns. Requires Bearer token belonging to a user with `profiles.role='admin'`.
  - `GET /api/v1/founders/welcome-context?session_id=cs_xxx` (NestJS, same controller, **public**) — server-side Stripe lookup powering the personalized "Welcome, [FirstName]." headline on `/founders/welcome`. Returns `{ firstName, paid }`; defends against bookmarked/stale/fishing requests by returning `{ firstName: null, paid: false }` for any session that isn't `payment_status === 'paid'` or doesn't start with `cs_`. Public-but-safe: the only PII exposed is the founder's own first name when they hand the endpoint their own session ID.
- **Server logs** the Supabase error code/details on insert failure (PG codes never leak to the client response).

### Non-functional

- **Performance:** Landing page has no audio bundle, no Three.js, no playback engine. The Three.js fretboard teaser was prototyped and removed in favor of CSS-animated dial cards.
- **Mobile-first:** entire page responsive; form is the primary mobile experience. Apple Pay verified working on iOS Safari (the production smoke test was an actual Apple Pay charge).
- **Scroll behavior:** `window.history.scrollRestoration = 'manual'` + explicit `scrollTo(0, 0)` on mount so reloads always land at the top.
- **Email deliverability:** sender domain `bassicology.com` verified on Resend (DKIM + SPF + DMARC, all on Vercel DNS). Welcome emails are dark-themed centered HTML with a plain-text fallback for clients that strip HTML. From `mar.c <mar.c@bassicology.com>`, Reply-To routes to the same Workspace inbox.
- **Production-grade Stripe wiring:** live webhook endpoint `bassicology-product` registered against `backend-production-612c.up.railway.app/api/v1/webhooks/stripe`, signature secret matches Railway prod env, subscribed to `checkout.session.completed` (and other platform billing events).

## Acceptance Criteria

### Shipped ✅

**Page**

- [x] Homepage at `/` (https://bassicology.com) renders the waitlist page; old landing preserved at `/preview`
- [x] Email field validates format client-side and server-side (Zod) before submit
- [x] Level radio required; submit blocked without selection
- [x] Successful submit persists a row in `waitlist`
- [x] Duplicate email submit returns success without throwing (idempotent, no enumeration leak)
- [x] Honeypot blocks bot submits (200 to bot, no write)
- [x] All three success states render after a successful submit and upsell skip
- [x] Page works on mobile Safari, mobile Chrome, desktop Chrome/Firefox
- [x] Scroll to top on every reload (no scroll restoration to mid-page)
- [x] All sections animate in via IntersectionObserver, honoring `prefers-reduced-motion`
- [x] Dev-only `Preview` chip on Groove Card, auto-hides in production (verified `NEXT_PUBLIC_VERCEL_ENV !== 'production'` gate works)
- [x] First-touch attribution captured on mount (UTM source/medium/campaign/content/term, document.referrer, landingPath, timezone) and persisted in localStorage with 30-day TTL; sent with both `/api/waitlist` and `/api/waitlist/founder-interest` submits and merged into the row's `metadata` JSONB
- [x] Founder purchases also record attribution via Stripe `client_reference_id` round-trip (`attr:<base64url JSON>`); webhook decodes and merges into `founder_members.metadata.attribution`
- [x] `/admin/funnels` dashboard live under existing `/admin` layout, gated by existing `AdminGuard`; shows aggregate counts, conversion rates, and top-5 UTM sources/campaigns; verified rendering real production data

**Founder payment pipeline**

- [x] `founder_members` table on both staging and production Supabase
- [x] Production Railway env vars: `RESEND_API_KEY`, `STRIPE_FOUNDER_PRICE_ID` (live), `STRIPE_FOUNDER_EMAIL_FROM`, `STRIPE_FOUNDER_EMAIL_REPLY_TO`, plus existing `STRIPE_SECRET_KEY` (live) and `STRIPE_WEBHOOK_SECRET` (matches Stripe Live mode endpoint signing secret)
- [x] Production Vercel env: `NEXT_PUBLIC_STRIPE_FOUNDER_LINK` set to live Payment Link URL
- [x] Live Stripe webhook `bassicology-product` registered against production backend URL, subscribed to `checkout.session.completed`, signing secret matches Railway env
- [x] Live Stripe Payment Link tagged with `purchase_type=founder_membership` metadata (matched by both the price ID and the metadata flag in the webhook)
- [x] `rawBody: true` on FastifyAdapter (without this, Stripe signature verification fails silently in ~6ms — see memory)
- [x] Founder-interest click persists a row in `founder_interest` before Stripe redirect
- [x] Same-tab Stripe handoff (`window.location.href`) — industry-standard pattern (no orphaned tabs, no failed `window.close()`)
- [x] Post-payment `/founders/welcome` page renders brand-matched dark celebration with personalized headline ("Welcome, [FirstName].") via server-side Stripe session lookup
- [x] Success overlay (animated check + "PAYMENT SUCCESSFUL", ~2.6s total) covers the welcome page on arrival to confirm the charge before the Stripe tab disappears
- [x] Overlay skipped on bookmarked/direct visits (no `session_id` param)
- [x] `useSearchParams()` wrapped in `<Suspense>` for Next 15 prerender bailout

**Email infrastructure**

- [x] `bassicology.com` verified on Resend (DKIM + SPF + DMARC on Vercel DNS)
- [x] `mar.c@bassicology.com` mailbox on Google Workspace (Workspace MX + SPF on Vercel DNS)
- [x] All DNS records live on Vercel nameservers — `bassicology.com` is single-source-of-truth at Vercel for both website AND email
- [x] Welcome email is dark-themed centered HTML (Bebas Neue / Impact stack, brand orange accent, transparent outer so the card pops in light-mode clients) with plain-text fallback
- [x] Reply-To routes to `mar.c@bassicology.com` Workspace inbox

**End-to-end verification**

- [x] Staging: webhook → row insert → welcome email arrives in Gmail (verified May 24)
- [x] Production: real $1 Apple Pay charge via Stripe coupon → webhook fired → `founder_members` row inserted with `mode='live'` → welcome email arrived at digmarec@gmail.com → public counter went 0 → 1 (verified May 25)
- [x] Test row deleted from production `founder_members` after verification; public counter back to 0 for real founders
- [x] All test secrets that briefly appeared in dev chat were rotated post-verification (Stripe test secret key, Stripe test webhook secret, Resend API key)

### Remaining 🚧

**Stop-ship before public traffic**

- [ ] **Replace Groove Card mockup with real interactive component.** The current card is a visual placeholder; the real Groove Card is the platform's atomic unit (per the product vision doc). The dev-only `Preview` chip is the only safety net during development and auto-hides on production — there's no visible reminder in prod that this is placeholder content. Treat as hard stop-ship signal before pointing YouTube CTAs at the page.

**Pre-launch hardening (nice-to-have, won't block first launch)**

- [ ] **Warm up the Resend sending domain.** New domains start with zero sender reputation; smaller European ISPs (seznam.cz, gmx, mail.ru) defer/quarantine the first ~50–100 emails. Send 5–10 test emails per day for 2 weeks before any high-volume broadcast to build reputation. (Verified failure mode against seznam.cz in early testing — Resend status stays "Sent" indefinitely. See memory note.)
- [ ] **Rate limit:** 5 signups per IP per hour on `POST /api/waitlist`. Use Next middleware or `@vercel/kv`-backed limiter.
- [ ] **Logged-in redirect:** if a visitor is authenticated, redirect off `/` to the platform home (or show a "you're already in" state). Currently the form accepts a signup from a logged-in user with their existing email and returns the duplicate-success state — gentlest failure mode but still wrong.

**Lower priority**

- [ ] **Founder-purchase failure alerting.** If Resend status doesn't reach "Delivered" within 5 min for a founder welcome, fire a Slack/email alert so we can manually reach out. Currently we'd only notice via dashboard inspection.
- [ ] **Decide if `POST /api/waitlist` should route through the NestJS backend** instead of being a Next route handler. Current choice (Next route): simpler, no DI/auth needed for an anon insert; uses Supabase anon key + RLS. Backend choice: matches the rest of the platform's API surface, easier to add rate-limiting/auth later. Document the decision either way; current shipped reality is the Next route.
- [ ] **Admin view of founder_members table.** Read directly from Supabase Studio for now.

**Migrate off Stripe Payment Links (defer to LAUNCH-03 membership)**

The founder $397 product currently runs on a Stripe Payment Link. This works fine for a single fixed-price product, but Stripe Payment Links have real limitations that will bite once we add the monthly membership and other paid products:

- **No locale override.** Payment Links auto-detect from the browser language; we can't force English. Czech-browser visitors see "Celkem dlužná částka" (literally "total amount owed") instead of "Amount due" — technically correct, but tonally off-brand. **Cannot be fixed without leaving Payment Links.**
- **No programmatic pricing** (e.g. region-specific pricing, dynamic discounts beyond a coupon code).
- **Awkward subscription↔user-account linking.** When the real Bassicology Membership ships, we'll need each subscription tied to a Supabase user account; Payment Links make this work but it's friction.
- **Customer email isn't pre-filled** when a logged-in user starts checkout.
- **Per-user success URLs aren't easy** (the redirect URL is configured per-link, not per-checkout).

**Plan**: when LAUNCH-03 (membership) work starts, build a `createCheckoutSession()` backend endpoint that uses Stripe's Checkout Sessions API instead. Same hosted Stripe page (trust intact), but full programmatic control: `locale: 'en'`, pre-filled customer email, per-user `success_url`, metadata, subscription routing. Use the new pattern for membership AND any future paid products. Optionally migrate the founder Payment Link to the same pattern later (no urgency — it works).

Until LAUNCH-03, the Czech phrasing on the founder checkout is documented but accepted.

## Out of Scope (deferred)

- ❌ Embedding the YouTube video — page is fast enough; no need.
- ❌ Email confirmation / double opt-in — wait until we know whether spam is an issue.
- ❌ Automated email _sequence_ — single welcome email is shipped; ongoing nurture sequence handled by LAUNCH-14.
- ❌ Real audio playback in the Groove Card — that's the real Groove Card component, separate work.
- ❌ Real 3D fretboard on the marketing page — prototyped and rejected (visual + bundle cost).

## Implementation Notes

### Files (shipped)

**Frontend**

- [apps/frontend/src/app/page.tsx](apps/frontend/src/app/page.tsx) — thin Next 15 server component that SSR-fetches the founder-card config from `/api/v1/founders/card-config` and renders `<WaitlistClient cardConfig={...} />`. Marked `export const dynamic = 'force-dynamic'` so every request gets the live config — admin edits go live on the next page load with no flash of default text. Falls back to `FOUNDER_CARD_CONFIG_DEFAULTS` if the backend is briefly unreachable.
- [apps/frontend/src/app/WaitlistClient.tsx](apps/frontend/src/app/WaitlistClient.tsx) — the entire waitlist page (single client component; sections inlined to keep one source of truth during early iteration). Used to be `page.tsx`; renamed in May 2026 when the page was split into RSC + client shell. Houses the form, the dial cards, the founder upsell, and the `FounderUpsell` confirmation header that branches on `signupIntent`.
- [apps/frontend/src/app/preview/page.tsx](apps/frontend/src/app/preview/page.tsx) — old marketing landing, preserved.
- [apps/frontend/src/app/founders/welcome/page.tsx](apps/frontend/src/app/founders/welcome/page.tsx) — post-payment landing page. Suspense-wrapped, brand-matched dark celebration with success overlay and personalized greeting fetched from the backend.
- [apps/frontend/src/app/admin/founder-card/page.tsx](apps/frontend/src/app/admin/founder-card/page.tsx) — admin editor for every string + per-block font size on the founder upsell card. Form on the left, live `<FounderCard>` preview on the right (renders the exact same component that ships on `/`). Persists via `PUT /api/v1/founders/card-config` (admin-gated). Tagged `*SizePx` keys render as numeric inputs with min/max from the shared Zod schema.
- [apps/frontend/src/shared/founder-card/FounderCard.tsx](apps/frontend/src/shared/founder-card/FounderCard.tsx) — pure presentational founder upsell card, shared by the homepage and the admin live preview. Single source of truth for the card visuals.
- [apps/frontend/src/shared/founder-card/markdown-bold.tsx](apps/frontend/src/shared/founder-card/markdown-bold.tsx) — inline `**bold**` renderer. The only formatting affordance admins get on the card's text fields (used for the vision paragraph + objection body).
- [apps/frontend/src/shared/components/ui/admin-guard.tsx](apps/frontend/src/shared/components/ui/admin-guard.tsx) — **client-side admin guard** wrapping the whole `/admin` layout. Reads role from `useUserProfile()` (with localStorage cache fallback for instant render). Non-admins redirect to `/`, unauthenticated to `/login`. Defense in depth — backend AdminGuard remains the security boundary.
- [apps/frontend/src/shared/dev/BackgroundTuner.tsx](apps/frontend/src/shared/dev/BackgroundTuner.tsx) — localhost-only draggable floating panel for vibing with the page's background (color + 2 radial gradients + noise overlay). Portals to `document.body` so `position: fixed` survives ancestor containing blocks. Drag position persists to localStorage. Gated by `NEXT_PUBLIC_VERCEL_ENV !== 'production'` in the parent. Currently commented out in `WaitlistClient.tsx`; uncomment to bring back.
- [apps/frontend/src/app/api/waitlist/route.ts](apps/frontend/src/app/api/waitlist/route.ts) — signup POST handler (Next route). Accepts the optional `signupIntent` field, persists into `waitlist.metadata.signupIntent`, defaults to `'beta'` for older callers.
- [apps/frontend/src/app/api/waitlist/founder-interest/route.ts](apps/frontend/src/app/api/waitlist/founder-interest/route.ts) — founder-interest POST handler (Next route).
- [apps/frontend/src/shared/attribution/index.ts](apps/frontend/src/shared/attribution/index.ts) — first-touch attribution capture (UTM, referrer, landing path, timezone) with 30-day localStorage TTL. Called once on page mount; `getStoredAttribution()` is read before each form submit.

**Shared types**

- [libs/contracts/src/validation/waitlist-schemas.ts](libs/contracts/src/validation/waitlist-schemas.ts) — Zod schemas + `WaitlistLevel` type + `signupIntents` enum (`'beta' | 'notify_only'`), shared across server + client.
- [libs/contracts/src/validation/founder-card-schemas.ts](libs/contracts/src/validation/founder-card-schemas.ts) — `FounderCardConfig` Zod schema with per-field min/max ranges + `FOUNDER_CARD_CONFIG_DEFAULTS` (mirrors the seeded DB row so the in-code fallback matches the seeded state).

**Backend (NestJS billing domain)**

- [apps/backend/src/domains/billing/webhook.controller.ts](apps/backend/src/domains/billing/webhook.controller.ts) — Stripe webhook handler; extended with `handleFounderCheckoutCompleted` and `isFounderCheckout` branch.
- [apps/backend/src/domains/billing/services/resend.service.ts](apps/backend/src/domains/billing/services/resend.service.ts) — Resend wrapper with `sendFounderWelcome` (HTML + plain-text builders).
- [apps/backend/src/domains/billing/repositories/founder-member.repository.ts](apps/backend/src/domains/billing/repositories/founder-member.repository.ts) — `createIfMissing`, `markWelcomeEmailSent`, `countByMode`.
- [apps/backend/src/domains/billing/founders.controller.ts](apps/backend/src/domains/billing/founders.controller.ts) — public `GET /api/v1/founders/count` (real founders + reserved 13 floor), public `GET /api/v1/founders/welcome-context` (powers `/founders/welcome` personalization via server-side Stripe session lookup), public `GET /api/v1/founders/card-config` (serves the admin-editable founder upsell card config to homepage SSR), admin-gated `PUT /api/v1/founders/card-config` (records `updated_by` from `auth.uid()`), AND admin-gated `GET /api/v1/founders/admin/funnels` endpoint. Admin endpoints protected by `@UseGuards(AdminGuard)`.
- [apps/backend/src/domains/billing/repositories/founder-card-config.repository.ts](apps/backend/src/domains/billing/repositories/founder-card-config.repository.ts) — load + save the singleton config row. Both paths re-validate the JSON against the FounderCardConfig Zod schema before returning/persisting. Falls back to `FOUNDER_CARD_CONFIG_DEFAULTS` on any read failure (missing row, schema-validation failure) so the homepage never breaks.
- [apps/backend/src/domains/billing/services/admin-funnels.service.ts](apps/backend/src/domains/billing/services/admin-funnels.service.ts) — server-side aggregator powering `/admin/funnels`. Pulls counts from `waitlist`, `founder_interest`, and `founder_members` (live + test), plus top-N UTM source/campaign aggregation from `waitlist.metadata`.
- [apps/frontend/src/app/admin/funnels/page.tsx](apps/frontend/src/app/admin/funnels/page.tsx) — the admin dashboard page. Fetches via Bearer token from the current Supabase session.
- [apps/frontend/src/app/admin/layout.tsx](apps/frontend/src/app/admin/layout.tsx) — extended with "Funnels" + "Founder Card" nav links, and now wraps the whole tree in `<AdminGuard>` so every `/admin/*` route is client-side gated by `profiles.role='admin'`. Previously the layout was reachable by anyone who knew the URL (backend endpoints were gated, but the UI shell still rendered).
- [apps/backend/src/domains/billing/billing.module.ts](apps/backend/src/domains/billing/billing.module.ts) — wires new providers + controller. Adds `FounderCardConfigRepository`.
- [apps/backend/src/main.ts](apps/backend/src/main.ts) — adds `{ rawBody: true }` to NestFactory.create. **Critical** for Stripe signature verification.

**Migrations**

- [supabase/migrations/20260522000001_create_waitlist.sql](../../../../supabase/migrations/20260522000001_create_waitlist.sql) — waitlist table + RLS.
- [supabase/migrations/20260522000002_grant_waitlist_insert.sql](../../../../supabase/migrations/20260522000002_grant_waitlist_insert.sql) — anon INSERT grant for waitlist.
- [supabase/migrations/20260524000001_create_founder_interest.sql](../../../../supabase/migrations/20260524000001_create_founder_interest.sql) — founder_interest table + RLS + GRANT (paired in one migration after the previous lesson).
- [supabase/migrations/20260524000002_create_founder_members.sql](../../../../supabase/migrations/20260524000002_create_founder_members.sql) — founder_members table + indexes + RLS (NO anon policies — backend mediates via service role).
- [supabase/migrations/20260525000001_create_founder_card_config.sql](../../../../supabase/migrations/20260525000001_create_founder_card_config.sql) — singleton `founder_card_config` table (id text PK, data JSONB, updated_at, updated_by uuid). No anon policies. Seeded with current shipped copy + sizes so the first homepage SSR after migration matches the in-code defaults exactly.

### Anti-patterns to avoid

- Don't add `autoFocus` to the email field — it auto-scrolls long pages to the form on mount, defeating the page's narrative.
- Don't embed the platform nav bar — `/` is the marketing surface, not part of the authenticated experience.
- Don't add testimonials we don't have. The founder quote is the only social-proof shape on the page; user quotes get added once they exist.
- Don't add a countdown timer — no hard open date.
- Don't ship the Groove Card mockup to production. The `Preview` chip auto-hides in prod; treat the placeholder as a stop-ship signal during PR review.
- Don't add `text-content-only` SELECT policies to `founder_members` for the public counter — the count endpoint should always go through the backend to keep rows private. Direct anon read would expose every founder's email, name, and Stripe IDs.
- Don't drop `rawBody: true` from the FastifyAdapter — Stripe signature verification fails silently in ~6ms otherwise (no log message in the standard path, just a `BadRequestException('Missing raw body')` thrown before signature verification even runs).

### Memory references

- [`supabase_rls_needs_grant.md`](../../../../.claude/projects/-Users-marekcaba-Documents-Projekty-2024----BassNotion-4--Cursor-Project-Folder-bassnotion-monorepo-v1/memory/supabase_rls_needs_grant.md) — RLS policies on new public tables need explicit `GRANT TO anon` alongside the policy; PG `42501` is the smoking gun.
- [`resend_new_domain_deliverability.md`](../../../../.claude/projects/-Users-marekcaba-Documents-Projekty-2024----BassNotion-4--Cursor-Project-Folder-bassnotion-monorepo-v1/memory/resend_new_domain_deliverability.md) — fresh Resend sending domains have zero reputation; smaller European ISPs defer/quarantine early sends even when DKIM/SPF/DMARC are green.

---

## Notes

- Once LAUNCH-09 (open day) ships, this page becomes a "between marketing pushes" catcher or gets repurposed. Decide closer to open.
- The `waitlist`, `founder_interest`, and `founder_members` tables are the source of truth for the launch email sequence (LAUNCH-14) and any pre-launch outreach. Founders specifically should get higher-touch treatment.
- PRs shipped: [#82](https://github.com/marekcaba/bassnotion-monorepo-v1/pull/82) (waitlist + initial founder upsell, develop), [#83](https://github.com/marekcaba/bassnotion-monorepo-v1/pull/83) (release to main with full founder payment pipeline + Resend integration), [#86](https://github.com/marekcaba/bassnotion-monorepo-v1/pull/86) (release: `/founders/welcome` page + same-tab Stripe handoff to main), [#87](https://github.com/marekcaba/bassnotion-monorepo-v1/pull/87) + [#88](https://github.com/marekcaba/bassnotion-monorepo-v1/pull/88) (success overlay + timing tweak on develop, pending release).
  </content>
