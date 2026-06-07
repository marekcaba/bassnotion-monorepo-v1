# Implementation Plan — Storefront (/app/store)

**Status:** Planning · **Created:** 2026-06-06
**Goal:** An in-app store at `/app/store` (Store icon in the left nav) that sells the existing monthly membership AND one-time products (Groove Packs, 4-Week Accelerator). Built for the long term — adding packs/products is a no-code admin task, packs can bundle many content items, and the entitlement gate stays simple.

**Builds on:** PR1 (`products`, product-scoped `purchases`, `EntitlementService`, `ProductRepository`) ✅, PR2 (video gating pattern to mirror) ✅. Membership subscription works end-to-end today.

---

## The big architectural decision (the "long-term, not MVP" part)

The single most important call: **how does a product (pack) relate to the content it unlocks?**

Today each content row has a single nullable `product_id` FK (`groove_library.product_id`, `videos.product_id`). That ships an MVP but **caps you within the first few packs**:
- ❌ A groove can't be in two packs (would force duplicating the heavy `stems` row).
- ❌ A pack can't bundle grooves + videos + exercises (membership fact scattered across 3 tables; no single "what's in this pack" query).
- ❌ A pack can't include existing free content as a teaser (`access_tier` is one value).

**Decision: introduce a `product_contents` join table.** This is the first real relational grouping primitive in the codebase (today grouping is ad-hoc: hardcoded TS folders, free-text `category`, JSONB id-arrays). It mirrors the proven `grooveId`-reference pattern tutorials already use. It makes "what's in pack X" one query, supports a groove in many packs, heterogeneous bundles, and the Accelerator's day-drip — all data-driven (no code per pack).

```sql
-- A product bundles many content items; an item can be in many products.
CREATE TABLE public.product_contents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('groove','video','exercise')),
  content_id   UUID NOT NULL,          -- polymorphic; integrity enforced in service layer
  unlock_day   INTEGER NOT NULL DEFAULT 0 CHECK (unlock_day >= 0), -- accelerator drip; 0 = immediate
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, content_type, content_id)
);
CREATE INDEX idx_product_contents_product ON public.product_contents(product_id);
CREATE INDEX idx_product_contents_lookup  ON public.product_contents(content_type, content_id);

-- Accelerator enrollment: one row per purchase of an accelerator product.
CREATE TABLE public.accelerator_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
```

**How the entitlement resolver evolves (security contract intact):** the `'product'` branch of `EntitlementService.canAccessContent` changes from "does the user own `item.product_id`?" to "does the user own ANY product that bundles this item (via `product_contents`), and — for accelerator items — is `unlock_day` reached given their enrollment `started_at`?" This is additive; the resolver stays the single authority. (The code already reserves this spot — `entitlement.service.ts:28-29`.)

> **Migration note:** keep `groove_library.access_tier`/`videos.access_tier` as the "is this gated" signal. Long-term, prefer resolving ownership via `product_contents` (drop reliance on the single `product_id` FK for grooves) so a groove can live in multiple packs. Free/member grooves don't use `product_contents` at all.

### Marketing metadata: promote to real columns
A store with many packs over years needs queryable marketing fields. Add to `products`:
```sql
ALTER TABLE public.products
  ADD COLUMN cover_image_url   TEXT,
  ADD COLUMN tagline           TEXT,
  ADD COLUMN preview_groove_id UUID REFERENCES public.groove_library(id);
```
Keep `metadata` jsonb for type-specific config (`{ duration_days: 28 }`). The "what's inside" list is derived from `product_contents`, not stored.

---

## The build — extends PR1, mirrors PR2 (mostly not new)

### A. Backend — one-time product checkout + recording

**A.1 Checkout** (`stripe.service.ts:208-258`): add a `type: 'product'` branch.
- Extend `CreateCheckoutSessionDto` (backend `billing.types.ts:185` + frontend `billing.types.ts:57`) with `type: 'product'` + `productId`.
- Inject `ProductRepository` into `StripeService`; resolve `product.stripePriceId`, `mode: 'payment'`, stamp `metadata.product_id`. Reuse the same `checkout.sessions.create` call. Same shared Stripe customer (`getOrCreateCustomer`) — purchases attach to the user's existing customer automatically.

**A.2 Webhook** (`webhook.controller.ts:155`): add the product branch in `handleCheckoutCompleted`.
- Read `metadata.product_id` (or resolve via `line_items[0].price.id → ProductRepository.findByStripePriceId`). Inject `ProductRepository`.
- `purchaseRepository.create({ productId, courseType: null, status: 'completed', … })`.
- Add an idempotency pre-check (`findByCheckoutSessionId`) — exists, currently relies on the UNIQUE constraint throwing.
- If the product is an `accelerator`: also insert `accelerator_enrollments(user_id, product_id)` (starts the drip clock).

**A.3 Refunds** (currently unhandled — a real gap): add a `charge.refunded` case to the webhook switch → `purchaseRepository.updateStatus(pi, 'refunded')`. Entitlement already only grants `completed` purchases, so this revokes access correctly.

**A.4 DB-backed catalog** (`billing.controller.ts:49`): swap `GET /products` from the hardcoded `COURSE_PRODUCTS`/`SUBSCRIPTION_PRODUCT` constants to `ProductRepository.findAllActive()`. Decide to omit `stripe_price_id` from the public payload (checkout resolves price server-side from `productId`). Backfill the membership row's `stripe_price_id` from `STRIPE_SUBSCRIPTION_PRICE_ID` so membership flows through the same catalog.

**A.5 Pack contents endpoint:** `GET /api/v1/products/:slug` → product + its `product_contents` (joined to groove/video/exercise titles) for the pack detail page. Public (catalog is public).

### B. Stripe dashboard (manual, per product)
For each pack/accelerator: create a one-time Price in the Stripe dashboard, paste its id into `products.stripe_price_id`. (Same pattern as the membership `STRIPE_SUBSCRIPTION_PRICE_ID` — the production-correct path; avoid runtime price creation for the catalog.)

### C. Frontend — the store page

**C.1 Nav** (`domains/platform/constants/navigation.ts`): add `{ title: 'Store', url: '/app/store', icon: ShoppingBag }` to `MAIN_NAV_ITEMS`. One line — wires desktop sidebar + mobile drawer + active-state automatically. No other nav edits.

**C.2 Route** (`apps/frontend/src/app/app/store/page.tsx`): `'use client'`, wrapped in `<PageErrorBoundary pageName="Store">`. Inherits `/app` layout (auth + left panel + audio + leather theme) automatically — no per-page wiring. Mirror the structure of `domains/billing/components/PricingSection.tsx` (catalog + `useCreateCheckoutSession` + `loadingItem`) and `app/library/page.tsx` (grid + loading/empty/error states).

**C.3 Reuse, don't reinvent:**
- `PricingCard.tsx` — price/feature-agnostic; works for membership AND one-time packs (omit `interval` → renders "one-time payment"). Drive owned/locked via `usePremiumAccess()`/`useEntitlement()`.
- `useCreateCheckoutSession` (extend frontend to pass `type: 'product', productId`), `useProducts`, `useUserAccess`, `useEntitlement`.
- `useToast()` (already globally mounted) for feedback.
- `<img>` + `onError` fallback (the `TutorialThumbnail` pattern) for pack covers — OR add `images.remotePatterns` for the Supabase host if using `next/image`.

**C.4 Visual voice:** match the in-app **amber `#E8A44A` / `#100E0D`** "instrument" voice (UpgradePitch, welcome page) — NOT the `/pricing` blue+`#ffc700` marketing voice — so the store feels native to `/app`. (Note: the two accents coexist inconsistently; worth aligning on one, but for the store use the in-app amber.)

**C.5 Post-purchase:** membership success → existing `/app/welcome` (polls `useUserAccess` until the webhook lands). Pack success → a `?success` handler on `/app/store` (mirror `pricing/page.tsx:28-45`) that toasts + refetches access so the pack shows as owned.

**C.6 Pack detail:** `/app/store/[slug]` — cover, tagline, "what's inside" (from `product_contents`), an embedded playable **preview groove** (`GrooveCardBlockView` with `mode="block"` — it's the real instrument, already used in-app), and Buy/Owned CTA. Don't instantiate `GrooveCardBlockView` per grid card (too heavy) — only on the detail page.

### D. Admin — add products without code (the long-term win)
- `ProductRepository` write methods (`create`/`update`/`deactivate`) — net-new (read-only today).
- Admin endpoints `POST/PATCH /api/v1/admin/products` + `POST /admin/products/:id/contents` (manage `product_contents`) behind `AdminGuard`. The `products` table already has admin RLS.
- Admin UI: a product form + a "add content to pack" multi-select (reuses the same `grooveId`-picker interaction the BlockEditor already has). This is what makes adding a pack a no-code task.
- Optional later: create the Stripe Price via API on product creation (so admins never touch the Stripe dashboard).

---

## Rollout order
1. **Schema:** `product_contents` + `accelerator_enrollments` + `products` marketing columns (additive; nothing breaks).
2. **Backend:** product-checkout branch + webhook recording + refund handler + DB-backed `GET /products` + pack-contents endpoint. Extend `EntitlementService` `'product'` branch to use `product_contents` (+ accelerator drip).
3. **Frontend store:** nav entry + `/app/store` + reuse PricingCard/hooks + pack detail. Membership sells immediately (already works); packs sell once Stripe prices exist.
4. **Admin product CRUD** (can follow once the store renders; until then, seed packs via SQL).
5. **Then** packs are real → PR3 (private `groove-stems` + signer) gates their stems, and the `product` tier finally has buyers.

> Membership selling can ship in step 3 with zero new product modeling — it already works. The pack machinery (steps 1-2) is what's net-new.

---

## What's reused vs net-new (so scope is honest)

**Reused / extended (most of it):** `products` table, product-scoped `purchases`, `ProductRepository` (read), `EntitlementService`, shared Stripe customer, `createCheckoutSession`, the webhook, `PricingCard`/`PricingSection`/billing hooks, toast, error boundaries, the config-driven nav, the `/app` layout.

**Net-new:** `product_contents` + `accelerator_enrollments` tables, `products` marketing columns, the `product` checkout branch + webhook product/refund/accelerator-enrollment recording, the pack-contents endpoint, the `/app/store` page + pack detail, `ProductRepository` write methods + admin product/contents CRUD + admin UI, Stripe dashboard prices per pack.

---

## ⚠️ Honest dependencies / caveats
- **Membership store works immediately**; packs need (a) this schema, (b) a Stripe price per pack, (c) PR3 to gate pack stems. The store can ship membership-only first, packs lit up as they're authored.
- **`product_contents` polymorphic `content_id`** has no single SQL FK (standard tradeoff for heterogeneous bundles); integrity lives in the service layer (consistent with the codebase's service-boundary rule). Alternative = 3 typed join tables (more tables, full FKs) — revisit if content types grow past ~5.
- **Accelerator drip** is the most novel piece — `accelerator_enrollments.started_at` + `product_contents.unlock_day` + the resolver day-check. Ship Groove Packs (flat) first; accelerator drip is an additive follow-up on the same tables.

---

## Open questions for the user
1. **Accent alignment:** the app has two gold accents (`#E8A44A` in-app vs `#ffc700` in older billing UI). Use in-app amber for the store (recommended), or align everything first?
2. **Scope of first build:** ship the store with **membership only** first (works today, fast), then add pack machinery? Or build the full pack model up front?
3. **Admin CRUD now or later:** build admin product management in the first pass, or seed the first pack(s) via SQL and add admin UI after the store renders?
4. **Accelerator:** is it needed in the first storefront build, or are Groove Packs (flat ownership) enough to start (accelerator drip as a follow-up)?
