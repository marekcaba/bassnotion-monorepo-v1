# Implementation Plan — Entitlements + One-Time Purchases + Content Gating

**Status:** Planning · **Owner:** marekcaba · **Created:** 2026-06-06
**Decisions locked in:** Security gate **first** (free-vs-member enforced now; `product` tier wired-but-dormant). One-time products to eventually sell: **Groove Pack** (flat ownership) + **4-Week Accelerator** (ownership + time-drip).

> Companion doc: [PLAN-content-access-gating.md](./PLAN-content-access-gating.md) (the URL-signing enforcement detail). This doc is the **foundation + sequencing** — read this first.

---

## The core insight

"Sell one-time purchases" and "secure the content" are **the same system**. Selling a Groove Pack = recording who bought it. Gating a Groove Pack video = checking that same record. One table (`purchases` → product-scoped), one resolver (`canAccessContent`). Build the shared foundation once; commerce and security become small follow-ups on top.

```
                  ┌──────────────────────────────────────┐
                  │  FOUNDATION  (PR 1 — build first)     │
                  │  products table · purchases→product   │
                  │  content access_tier/product_id       │
                  │  EntitlementService.canAccessContent  │
                  └──────────────────────────────────────┘
                     │                              │
        ┌────────────┘                              └────────────┐
        ▼ SELLING (later, when storefront ships)                 ▼ PROTECTING (now)
  one-time Stripe checkout · webhook→purchase·UI         Bunny + Supabase signed URLs gated by resolver
```

---

## What already exists (you're ~40% there)

| Piece | Status | Evidence |
|---|---|---|
| Monthly subscription end-to-end | ✅ built | `subscriptions` table, webhook `customer.subscription.*`, `hasActiveSubscription` |
| Founder/lifetime = full membership | ✅ built | `grantLifetimeMembership` → synthetic active row (year-2099 period_end) |
| One-time payment **rail** | ⚠️ generic | `purchases` table + `payment`-mode checkout + webhook `checkout.session.completed` course branch |
| `purchases` product identity | ❌ | `course_type CHECK ('basic','standard','premium')` — no pack/accelerator, no per-pack id (`20250105_create_billing_tables.sql:49`) |
| Products/SKU catalog (DB) | ❌ | hardcoded TS constant `COURSE_PRODUCTS` (`billing.types.ts`) |
| Content → product link | ❌ | `groove_library` has **no** tier/product column; `stems` JSONB bakes audio-sample URLs (`20260602000005_create_groove_library.sql`) |
| Server `canAccess(user, item)` | ❌ | only client-side `useEntitlement` (lever-cap UX) |
| Accelerator drip | ❌ | `learning_journeys` exists but no payment/time-lock |

---

## PR 1 — The entitlement foundation (no user-visible change)

The longest pole. Ships nothing visible but unblocks both commerce and security. Pure additive schema + one service.

### 1.1 `products` catalog table
```sql
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,           -- 'monthly-membership', 'groove-pack-funk-101', '4week-economy-picking'
  type            TEXT NOT NULL CHECK (type IN ('membership','groove_pack','accelerator','course')),
  name            TEXT NOT NULL,
  description     TEXT,
  stripe_price_id TEXT UNIQUE,                    -- maps Stripe → internal product (replaces in-memory priceIds map)
  price_cents     INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'usd',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. accelerator { duration_days: 28 }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: public read of is_active=true (the storefront catalog is public); admin/service write.
```
Seed the monthly membership row first (so the model is uniform from day one). Pack/accelerator rows added when those products are authored.

### 1.2 Make `purchases` product-scoped
```sql
ALTER TABLE purchases ADD COLUMN product_id UUID REFERENCES public.products(id);
ALTER TABLE purchases DROP CONSTRAINT purchases_course_type_check;   -- relax the rigid enum
ALTER TABLE purchases ALTER COLUMN course_type DROP NOT NULL;        -- keep for legacy/back-compat, nullable
CREATE INDEX idx_purchases_product_id ON purchases(product_id);
-- (no legacy rows to backfill pre-launch; if any exist, map course_type→a products row)
```
Repository: add `hasPurchasedProduct(userId, productId)` and `getPurchasedProductIds(userId)` (mirror the existing `hasPurchasedCourse`/`getPurchasedCourses`).

### 1.3 Content ↔ tier/product linkage
The column that makes "free vs member vs pack" expressible. Add to each gateable content surface:
```sql
-- groove_library
ALTER TABLE public.groove_library
  ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free','member','product')),
  ADD COLUMN product_id UUID REFERENCES public.products(id);
ALTER TABLE public.groove_library
  ADD CONSTRAINT groove_tier_product_ck
    CHECK (access_tier <> 'product' OR product_id IS NOT NULL);
```
- Same two columns on the **video registry** (PR 2) and tutorials when those get gated.
- **Default `'free'`** = nothing changes behavior on day one (safe migration). You then flip specific grooves/videos to `'member'`/`'product'` as content is curated.
- **Tighten `groove_library` RLS**: replace "public read of all active rows" with public read of `access_tier='free'` rows only; `member`/`product` rows are resolved server-side (don't leak premium content existence to anon beyond an intentional teaser). *(Do this in the same PR as the resolver so listing endpoints still work.)*

### 1.4 `EntitlementService.canAccessContent` — the security core
One function, the **single** authority. Lives in the billing domain next to the repos.
```ts
async canAccessContent(userId: string | null, item: { access_tier; product_id? }): Promise<boolean> {
  if (item.access_tier === 'free') return true;
  if (!userId) return false;
  if (item.access_tier === 'member')  return this.subscriptionRepo.hasActiveSubscription(userId); // founders included
  if (item.access_tier === 'product') {
    if (!await this.purchaseRepo.hasPurchasedProduct(userId, item.product_id)) return false;
    // accelerator time-drip layers here later (owns product AND day N unlocked)
    return true;
  }
  return false;
}
// + batch: filterAccessible(userId, items[]) — one subscription read + one purchases read, filter in memory.
```
Frontend `useEntitlement` stays as a **UX hint only** (lock icons, upsell copy) — never the boundary. The resolver gates the actual URL minting.

### 1.5 Tests (the important part of this PR)
Table-driven matrix — this is the security contract:
`{anon, free-user, member, founder, pack-buyer}` × `{free, member, pack-owned, pack-not-owned}` → expected allow/deny. Add `accelerator-day-N` rows when Tier 4 lands.

**PR 1 deliverable:** products table seeded with membership, product-scoped purchases, `access_tier` columns (defaulting free → no behavior change), `EntitlementService` + tests. Nothing user-visible; everything downstream unblocked.

---

## PR 2 — Bunny video gating (security, enforces free vs member)

Independent, lowest blast radius, dashboard rollback. Detail in the companion doc Part C. In short:
- Enable Bunny **Token Authentication**; add `BUNNY_TOKEN_AUTH_KEY` secret.
- Video registry rows carry `access_tier`/`product_id` (PR 1 columns).
- `bunny-video.service.ts` signs (`sha256_hex(key + videoId + expires)`, hex, seconds).
- `GET /api/v1/videos/:videoId/playback-url` (`OptionalAuthGuard`) → look up tier → `canAccessContent` → sign or 403.
- Strip raw IDs from public payloads; frontend `useSignedVideoUrl` hook feeds the iframe; handle 403→upsell.
- **Now:** free videos play for anyone, member videos require a subscription. `product` branch works the moment a pack product+content link exists.

## PR 3 — Supabase storage signer + frontend resolver (buckets STILL public)

Additive; no flip yet. Detail in companion Part D.2–D.3.
- `POST /api/v1/storage/signed-urls` (batch, `OptionalAuthGuard`, entitlement-aware for premium prefixes).
- Centralize the ~30 public-URL call sites behind **one resolver** (`AudioStorageService`/`SupabaseProvider`). **Critical:** `groove_library.stems` JSONB bakes audio-sample URLs — the resolver must sign stem paths at read-time, and the row should store **paths**, not full public URLs (migration to strip the `/public/` prefix from existing `stems`).
- After this deploys, the frontend no longer constructs public URLs.

## PR 4 — Flip buckets private + demo carve-out (the gate closes)

- New **public `demo-grooves`** bucket; copy `economy-groove-1` stems; repoint `waitlistGrooveCard.config.ts:29`.
- `UPDATE storage.buckets SET public=false` for `audio-samples`, `exercise-files`, `exercise-midi-files`, `patterns`.
- Because PR 3 already routes through signed URLs, this is a no-op for users and a real gate for attackers.
- **Hard rule:** PR 4 migration must never merge before PR 3's resolver is deployed.

## PR 5 — Exercise MIDI + filename sanitization (small)
- `download-midi` endpoint `getPublicUrl`→`createSignedUrl`; reroute `ExerciseLoader` client path through it; sanitize `file-upload.service.ts:57`.

---

## Later (storefront — when you decide to actually SELL packs)

The security gate ships **without** these. When you're ready to sell:

### S1 — Stripe one-time checkout for a real product
- Extend `createCheckoutSession`: `payment` mode, line item = the product's `stripe_price_id`, metadata `{ user_id, product_id }`.
- Create the Stripe product/price for the Groove Pack / Accelerator; insert the matching `products` row with that `stripe_price_id`.

### S2 — Webhook records the purchase against the product
- In `checkout.session.completed` (`webhook.controller.ts`): resolve `metadata.product_id` (or `price_id → products` lookup) → `purchaseRepo.create({ product_id, status:'completed', … })`.
- Idempotent on `stripe_payment_intent_id` (already UNIQUE).
- The moment a purchase row exists, `canAccessContent` lets that user through `product`-tier content — **no gate code changes needed.** That's the payoff of the foundation.

### S3 — Storefront UI
- Catalog from `GET /api/v1/billing/products` (now DB-backed). Pack detail page → checkout button. "Owned" state from `getPurchasedProductIds`.
- Lock icons on gated grooves/videos use `useEntitlement` (already anticipates packs — the `grooveId` param + "Drill the layers with a Groove Pack" copy are there).

### S4 — Accelerator drip (Tier 4)
- `accelerator_enrollments (user_id, product_id, started_at)`; day-N content unlocks when `now - started_at >= N days` AND owns product.
- Pure addition to the `product` branch in `canAccessContent`.

---

## Build order (one line)

**PR1 foundation → PR2 Bunny → PR3 storage signer → PR4 flip private (+demo) → PR5 exercise MIDI** … then, when selling: **S1 checkout → S2 webhook → S3 storefront → S4 accelerator.**

PR1 unblocks everything. PR2 is the fastest standalone win. PR3→PR4 must stay ordered. Everything after PR4 (storefront) is revenue work that does **not** touch the gate.

---

## Open items to confirm before PR1
1. **Second Supabase host** — `LongPadSampler.ts:30`/`TheSawSampler.ts:30` use project `htuztkrbuewheehjspcz` (not the main `iuuplfrktnzsbzibpfjm`). Gated, legacy, or external? Affects PR3.
2. **Canonical exercise bucket** — `exercise-files` vs `exercise-midi-files` (temp→permanent targets the latter). Affects PR4/PR5.
3. **Stripe price for monthly** — confirm `STRIPE_SUBSCRIPTION_PRICE_ID` so the seed `products` row for membership has the right `stripe_price_id`.
