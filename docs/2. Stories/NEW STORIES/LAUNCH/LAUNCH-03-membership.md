# [LAUNCH-03] Membership Infrastructure — $24/mo Recurring

**Parent:** [Launch Backlog](./README.md) • [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~1 week
**Status:** 📝 Ready
**Depends on:** LAUNCH-02 (caps must exist to be uncapped)
**Blocks:** LAUNCH-06 (Pack), LAUNCH-07 (Accelerator), LAUNCH-08 (Bundle), LAUNCH-11 (Whitelist conversion)
**The thing this story is:** the recurring heart of the business. The single durable revenue line everything else stacks on.

---

## Story

- As a **free user who just hit the tempo cap (or mute cap, or transpose cap)**
- I want to **see exactly what removing the cap costs and click once to remove it**
- so that **I'm practicing without limits in 60 seconds, not reading a pricing page**

And:

- As a **logged-in member**
- I want to **have every cap removed across every free groove, every weekly groove, and every future weekly groove**
- so that **the membership is the "practice without limits" verb the funnel-vision promises**

And:

- As **Marek launching the recurring business**
- I need **Stripe subscriptions wired end-to-end with webhook-driven entitlement updates**
- so that **billing state and cap state never drift out of sync**

## Background / Context

The funnel-vision identifies Membership as **the recurring heart** — the one obvious recurring yes that uncaps every lever. Per the product tiers table:

> **Membership — $24/mo — practice without limits — The cap comes off everything: full tempo, all keys, infinite loop, scoring, *plus the never-capped widgets and notation*. The recurring heart.**

Stripe checkout works today (verified in BETA Plan: "✅ Works — end-to-end tested in Phase 6.2"). What does NOT exist:
- A Stripe **subscription** product for Membership (current Stripe setup has one-time purchase courses + one $14/mo subscription).
- The `'member'` tier in the entitlement system from LAUNCH-02.
- Webhook handling that grants/revokes membership on `customer.subscription.*` events.
- The "uncap" path — LAUNCH-02 builds caps, this story builds the bypass for members.
- Membership management (cancel, billing portal, view next charge).

This is the **simplest paid product** mechanically (one Stripe product, one entitlement flag), which is exactly why it goes first: it validates the entire cap → checkout → webhook → entitlement → uncap loop end-to-end before we add Pack and Accelerator complexity on top.

### The coherence test (from funnel vision)

A happy free user (playing capped grooves) → "I keep hitting the ceiling, I want to really practice this" → **Membership** ✓

That's the conversion this story is designed to capture.

## Solution / Scope

### 1. Stripe product setup

- **Create new Stripe subscription product** at $24/mo: `Bassicology Membership`
- **Register in `StripeService.onModuleInit()`** alongside existing products
- **Use the existing $14/mo subscription** as a reference for the wiring, but don't reuse — Membership is a distinct SKU

### 2. Backend — subscription lifecycle

- **Webhook handler** for the four events that matter:
  - `customer.subscription.created` → grant `member` entitlement
  - `customer.subscription.updated` → update entitlement (status changes, plan changes)
  - `customer.subscription.deleted` → revoke `member` entitlement at period end
  - `invoice.payment_failed` → mark subscription as `past_due`; keep entitlement for grace period (e.g., 7 days), then revoke
- **`memberships` table** (or extend existing subscription table):
  - `user_id uuid pk`
  - `stripe_subscription_id text`
  - `status text` — `'active' | 'past_due' | 'canceled' | 'incomplete'`
  - `current_period_end timestamptz`
  - `cancel_at_period_end boolean`
  - `created_at`, `updated_at`
- **`EntitlementService` updates** (from LAUNCH-02) — return `tier: 'member'` when membership row is `active` OR (`past_due` AND within grace period)

### 3. Frontend — checkout flow

- **From any `<UpsellCue>` (LAUNCH-02)** → click → Stripe Checkout session created server-side → redirect to Stripe Checkout → on success, redirect back to the groove they were on
- **On return:** show a confirmation overlay *"You're a member. Every cap is gone."* + auto-refresh entitlement → user is now on the same groove with caps off, mid-session
- **The zero-seam handoff:** the upsell click should land them back on **the same groove at the same position** where they hit the cap, just uncapped. Not a generic thank-you page.

### 4. Frontend — membership management

- **`/account/membership`** — view status, next charge date, "manage billing" button (deep-links to Stripe Customer Portal)
- **Cancel flow** — use Stripe Customer Portal, don't build custom UI. Cancellation = `cancel_at_period_end: true`; user keeps access through period end.
- **Past-due banner** — if subscription is `past_due`, show a banner in the platform: *"Your payment failed. [Update card →]"*

### 5. Entitlement sync

- **On webhook event** → update `memberships` table → invalidate cached entitlement → next `GET /billing/entitlement` returns fresh
- **On frontend tier change** → invalidate the `useEntitlement()` cache → re-render with new caps

## Requirements

### Functional

- [ ] Stripe `Bassicology Membership` subscription product registered ($24/mo)
- [ ] `GET /billing/checkout/membership` creates a Stripe Checkout session and returns redirect URL
- [ ] Stripe webhook handles `customer.subscription.{created,updated,deleted}` and `invoice.payment_failed`
- [ ] `memberships` table tracks subscription state and is the source of truth for tier
- [ ] `EntitlementService` returns `member` tier for `active` or grace-period `past_due` subscriptions
- [ ] `<UpsellCue>` click flow: click → checkout → success → redirected back to same groove, uncapped
- [ ] `/account/membership` page shows status, next charge, manage button (deep-link to Stripe Portal)
- [ ] Past-due banner appears when payment fails; clears when payment succeeds

### Non-functional

- [ ] Webhook handler is idempotent (Stripe retries; handler must tolerate duplicate events)
- [ ] No drift between Stripe state and `memberships` table — on app boot, a reconciliation job (optional, but document the gap) could verify
- [ ] Checkout flow tested in Stripe **test mode** end-to-end before any production cards are touched
- [ ] All Stripe API calls use the Node SDK with proper error handling — failures don't crash the checkout flow

### Security

- [ ] Webhook signature verification — reject events without valid signature
- [ ] Subscription ownership check — a user can only manage their own subscription
- [ ] No client-side trust of tier — every cap check goes through the server-validated `EntitlementService`

## Acceptance Criteria

- [ ] Free user clicks tempo upsell cue → lands in Stripe Checkout (test mode) within 2s
- [ ] On test-mode card success → redirected back to the same groove with caps removed
- [ ] Webhook event `customer.subscription.created` fires → `memberships` row inserted → entitlement returns `member`
- [ ] Webhook event `customer.subscription.deleted` at period end → entitlement returns `free` after period end timestamp
- [ ] Failed payment (use Stripe test card `4000 0000 0000 0341`) → `past_due` status set → grace period banner shown → after grace, entitlement returns `free`
- [ ] Manual QA on staging: subscribe → confirm caps removed across all 4 levers; cancel → confirm caps return at period end
- [ ] Stripe webhook idempotency verified: same event ID processed twice = same end state, no duplicate rows
- [ ] Membership management page shows correct status and next charge date
- [ ] All caps from LAUNCH-02 are removed when `useEntitlement()` returns `'member'`
- [ ] Backend unit tests cover webhook handlers + entitlement service
- [ ] Integration test: free → checkout → member transition end-to-end in test mode

## Out of Scope (deferred to other stories)

- ❌ **Founding Membership ($397 lifetime)** — LAUNCH-13, post-open. Lifetime entitlement is a *different* row type (no recurring), handled separately.
- ❌ **Pack and Accelerator purchases** — LAUNCH-06, 07. Those are separate Stripe products with separate entitlements.
- ❌ **Bundle discount logic** — LAUNCH-08.
- ❌ **Whitelist 1-month-free grant** — LAUNCH-11. That story uses this Stripe infrastructure but adds the trial-grant flow on top.
- ❌ **Email receipts customization** — use Stripe's default receipts for launch.
- ❌ **Annual Membership** — defer until we see demand.
- ❌ **Proration on plan changes** — N/A; only one Membership plan.
- ❌ **Multi-seat / team Memberships** — not relevant pre-launch.

## Implementation Notes

### Files to touch

**Backend:**
- **EDIT:** `apps/backend/src/domains/billing/services/stripe.service.ts` — register Membership product in `onModuleInit`
- **EDIT:** `apps/backend/src/domains/billing/webhook.controller.ts` — add subscription event handlers
- **EDIT:** `apps/backend/src/domains/billing/billing.controller.ts` — add `POST /billing/checkout/membership` and `GET /billing/membership`
- **NEW:** `apps/backend/src/domains/billing/services/membership.service.ts` — lifecycle ops
- **EDIT:** `apps/backend/src/domains/billing/services/entitlement.service.ts` (from LAUNCH-02) — check `memberships` table
- **EDIT:** `apps/backend/src/domains/billing/types/billing.types.ts` — `MembershipStatus`, `MembershipResponse`
- **NEW:** `supabase/migrations/[timestamp]_memberships_table.sql`

**Frontend:**
- **EDIT:** `apps/frontend/src/domains/billing/components/UpsellCue.tsx` (from LAUNCH-02) — wire click to checkout
- **NEW:** `apps/frontend/src/app/account/membership/page.tsx`
- **NEW:** `apps/frontend/src/domains/billing/hooks/useMembership.ts`
- **NEW:** `apps/frontend/src/domains/billing/components/PastDueBanner.tsx`
- **NEW:** `apps/frontend/src/app/(public)/membership/success/page.tsx` — landing after Stripe success
- **EDIT:** `apps/frontend/src/domains/billing/hooks/useEntitlement.ts` (from LAUNCH-02) — refresh on membership status change

**Shared types:**
- **EDIT:** `libs/contracts/src/types/billing.ts` — `MembershipStatus`, `MembershipResponse` schemas

### Architectural guidance

- **Stripe is the source of truth for billing state.** Our table mirrors it, updated by webhook. Never compute "is member" from local state — always check the table that the webhook writes.
- **Grace period for `past_due`.** When a payment fails, don't immediately revoke. Stripe retries the card a few times over ~7 days. We keep entitlement during that window so a temporary card issue doesn't break the experience.
- **Idempotent webhook handlers.** Stripe will retry events. Every handler must be safe to run N times for the same event ID.
- **The zero-seam handoff matters.** The user clicked an upsell *at a specific groove at a specific cap*. After Stripe success, return them *there*, mid-session. Stripe Checkout supports `success_url` with custom params — encode the groove ID and position.

### Stripe checkout success_url pattern

```
${APP_URL}/membership/success?groove=${grooveId}&t=${transportPosition}
```

The success page reads the params → invalidates entitlement → redirects to `/groove/[id]?t=...` with caps off.

### Anti-patterns to avoid

- **Don't build a custom cancel UI.** Stripe Customer Portal handles this — link to it. Less code, more compliant.
- **Don't hard-code Stripe price IDs in source.** Use env vars (already pattern in `stripe.service.ts`).
- **Don't trust client-side tier.** Server-side entitlement check on every gated action.
- **Don't show membership-specific features to non-members at all** when possible — but if a member-only feature is visible (the deconstruction layer side panel, for example), the gate must be server-side, not just a CSS class.

---

## Notes

- This story is **the first time the full funnel loop runs end-to-end**. Once it's green, we can:
  1. Run real test users through it.
  2. Measure cap-hit → checkout-click → payment-success conversion.
  3. Iterate on cap UX before adding more SKUs.
- After this ships, LAUNCH-06 (Pack) and LAUNCH-07 (Accelerator) are *additions* to a working system, not greenfield. Much lower risk.
- The **Founding Membership ($397 lifetime)** lives separately because it's not a recurring subscription — different row type, different grant logic. That's LAUNCH-13.
