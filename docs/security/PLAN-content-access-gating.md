# Implementation Plan — Gate Premium Content (HIGH severity)

**Status:** Planning · **Owner:** marekcaba · **Created:** 2026-06-06 · **Revised:** 2026-06-06 (4-tier model)
**Risk addressed:** Content is effectively public (Bunny videos + Supabase storage objects served with no access control). #1 business-model risk from the June 2026 security assessment — premium content is the moat, and the moat is currently open.

---

## The problem in one paragraph

Both content systems hand the **raw, permanent, public URL to the browser** and let anyone fetch it:

- **Bunny videos** — the frontend builds `https://iframe.mediadelivery.net/embed/{lib}/{id}` in-browser from DB-sourced IDs delivered through *unauthenticated* backend read endpoints. No token, no entitlement check. The backend has **zero Bunny configuration** today.
- **Supabase storage** — `audio-samples` ("professional audio content"), `exercise-files`, `exercise-midi-files`, and `patterns` are **public buckets**. `getPublicUrl()` returns non-expiring URLs anyone can fetch. The recent migration only stopped *listing*; individual objects are still world-readable by URL.

---

## ⚠️ The real scope: gating requires an entitlement model that doesn't exist yet

The product has **four access tiers** (confirmed with the owner). The current system only understands **one binary**: `hasActiveSubscription`. That is nowhere near enough.

### The four tiers

| Tier | Who can access | Examples | Current support |
|---|---|---|---|
| **1. Public / free** | Everyone (anon or logged in) | Free videos, free groove cards, free functionality | ✅ default |
| **2. Membership** (monthly $24, + founder/lifetime) | Active subscribers | All functionality + member-only groove cards + member-only videos | ✅ `subscriptions.hasActiveSubscription` |
| **3. Groove Pack** (one-time purchase) | Only buyers of *that specific pack* — **NOT** members who didn't buy it | Pack videos (never public) | ❌ does not exist |
| **4. 4-Week Accelerator** (one-time purchase) | Only buyers — 30-day locked path | Drip-released locked content | ❌ does not exist |

### Why the current model can't express this

The critical rule is **Tier 3/4 are product-scoped, not membership-scoped.** A monthly member does **not** automatically get a Groove Pack they didn't buy. So the gate can't be `hasActiveSubscription` — it must answer *"does this user have access to **this specific content item**,"* which depends on what product the item belongs to and what the user purchased.

What the codebase has today (from the entitlement audit):
- ✅ `subscriptions` table + `hasActiveSubscription(userId)` + founder lifetime grant (synthetic active row). **Tier 2 is solved.**
- ⚠️ `purchases` table exists **but** `course_type` is a hardcoded CHECK enum `('basic','standard','premium')` — **no Groove Pack, no Accelerator, no per-pack identity.** Can't tell *which* pack was bought.
- ❌ **No products/SKU table** — catalog is a hardcoded TS constant (`COURSE_PRODUCTS`). Groove Pack / Accelerator don't exist as product types anywhere in code or DB (only in launch docs).
- ❌ **No content↔product linkage.** `groove_library`, `tutorials`, and groove-card block configs have **no** `product_id` / `is_premium` / `access_tier` / `pack_id` column. Nothing ties a content row to an entitlement. `groove_library` RLS is *public-read of all active rows*.
- ❌ **No server-side `canAccess(userId, contentItem)` resolver.** All gating today is the binary subscription flag, computed **client-side** (drives Groove Card lever caps only — `useEntitlement`). The `grooveId` param in `useEntitlement` is explicitly "reserved for LAUNCH-06 per-pack entitlements" but ignored.
- ❌ **No accelerator drip/time-lock infrastructure.** `learning_journeys` exists but has no payment gate, no purchase link, no day-based unlock.

**Conclusion:** This is no longer "swap public URLs for signed URLs." It is **build a content-entitlement system, then gate URL minting behind it.** The URL-signing work (Parts C & D below) is the *enforcement layer*; it's useless without the *entitlement layer* (Parts A & B) underneath. The good news: the security-critical enforcement can ship for Tiers 1+2 first (which exist), with Tiers 3+4 layering on once the product/purchase model is built.

---

## Part A — Entitlement data model (NET NEW — the foundation)

### A.1 Products / SKU catalog
A real catalog so a purchase can name *which* product, and content can point at one.
- **New table `products`**: `id, slug (unique), type ('membership'|'groove_pack'|'accelerator'|'course'), name, stripe_price_id, price_cents, currency, is_active, metadata jsonb`.
- Seed: the monthly membership, each Groove Pack, the 4-Week Accelerator.
- Replaces the in-memory `priceIds` map binding (Stripe price id → product). The webhook resolves `price_id → products.id` from the DB.

### A.2 Purchases → product-scoped
- Migrate `purchases`: relax the `course_type` CHECK; add `product_id` (FK → products). Backfill legacy rows.
- Generalize `PurchaseRepository.hasPurchasedCourse` → `hasPurchasedProduct(userId, productId)`; keep `getPurchasedProductIds(userId)` for batch checks.

### A.3 Content ↔ product / tier linkage
Every gateable content item needs to declare its access requirement.
- Add to gateable content rows (`groove_library`, tutorial/video block configs, and the new video registry in C.2): `access_tier ('free'|'member'|'product')` and `product_id` (nullable FK, required when `access_tier='product'`).
  - `free` → Tier 1 (anyone). `member` → Tier 2 (active subscription/founder). `product` → Tier 3/4 (must own `product_id`).
- Tighten `groove_library` RLS: public-read only of `access_tier='free'` rows; member/product rows resolved server-side via the signer (don't leak member/pack content existence to anon beyond a title/teaser if desired).

### A.4 Accelerator drip (Tier 4) — can defer
- **New table `accelerator_enrollments`**: `user_id, product_id, started_at, …` → unlock day N content when `now - started_at >= N days` **and** user owns the product.
- The day-based unlock is additive on top of the `product` tier check. Ship Tier 3 (packs) first; Tier 4 reuses the same ownership check + a time gate.

---

## Part B — The authorization resolver (NET NEW — the brain)

A single server-side function is the **one place** that decides access. Everything (video signer, storage signer, content lists) calls it.

```
canAccessContent(userId | null, item: { access_tier, product_id }): boolean
  free            → true (always, even anon)
  member          → subscriptionRepo.hasActiveSubscription(userId)   // founders included (synthetic active row)
  product         → purchaseRepo.hasPurchasedProduct(userId, item.product_id)
                    (+ accelerator: AND day-unlock check)
```
- Lives in a `EntitlementService` in the billing domain (next to the existing repos).
- Batch variant `filterAccessible(userId, items[])` for list endpoints (one subscription read + one purchases read, then in-memory filter).
- **This is the security boundary.** Frontend `useEntitlement` stays as a UX hint (show lock icons / upsell) but is **never trusted** — the resolver gates the actual URL minting.

---

## Part C — Bunny video gating (enforcement)

### C.1 Bunny dashboard + secrets (manual, one-time)
- Enable **Embed View → Token Authentication** on the Bunny library.
- Add backend secret `BUNNY_TOKEN_AUTH_KEY` (local `.env`, Railway staging+prod, GitHub Actions). Add `BUNNY_LIBRARY_ID` config (replaces hardcoded `583585`).

### C.2 Video registry (so videos can be tiered)
- Videos currently live as loose IDs in tutorial blocks / segment rows with **no tier**. Add an `access_tier`+`product_id` per video — either columns on the existing rows or a small `videos` table keyed by `bunny_video_id`. This is what makes "free video vs member video vs pack video" expressible.

### C.3 Signer service + gated endpoint
- **`bunny-video.service.ts`** — `signEmbedUrl(videoId, libraryId)`: `token = sha256_hex(BUNNY_TOKEN_AUTH_KEY + videoId + expires)`, `expires = nowSec + ttl`; URL `…/embed/{lib}/{id}?token={token}&expires={expires}`. (Hex, order key+videoId+expires, seconds — confirmed from Bunny docs.) Pure crypto, no network.
- **`GET /api/v1/videos/:videoId/playback-url`** — `@UseGuards(OptionalAuthGuard)` (free videos must work for anon):
  1. look up the video's `{access_tier, product_id}` (404 if unknown — no signing oracle for arbitrary IDs)
  2. `entitlementService.canAccessContent(userId, video)` → 403 if denied (+ which tier/product is needed, for the upsell)
  3. else `bunnyVideoService.signEmbedUrl(...)` → `{ embedUrl, expires }`
- TTL proposal: **6h** (covers a practice session; a leaked URL dies same-day).

### C.4 Strip raw IDs + frontend fetch
- Stop exposing raw `videoLibraryId`/`videoId` on public payloads (`tutorials.service.ts:276-277`, `assessment.service.ts:631-633`, `segment-assessment.controller.ts:98`, contracts `tutorial.ts:54-56` / `assessment.ts:182-184`). Keep `videoId` only as the lookup key for the gated signer.
- Frontend: `useSignedVideoUrl(videoId)` → the endpoint → feeds `<iframe src>`. The 5 build sites: `useBunnyPlayer.ts:157` (shared — also `BunnyQuizPlayer.tsx:133`, `UnderstandVideoPlayer.tsx:123`), `SegmentVideoPlayer.tsx:100`, `ExplainBlockView.tsx:62`, admin authoring sites. Handle 403 → upsell; re-fetch on expiry. Remove hardcoded fallback IDs (`quizQuestions.ts:15-16`).

---

## Part D — Supabase storage gating (enforcement)

### D.1 Flip buckets private (migration — the sharp edge)
- `UPDATE storage.buckets SET public=false WHERE id IN ('audio-samples','exercise-files','exercise-midi-files','patterns');`
- Keep **public**: `avatars`, `tutorial-thumbnails`, and the new **`demo-grooves`** bucket (D.5). `exercise-midi-temp` already private.
- **Migrations run via the deploy workflow — do not `db push` by hand.** Frontend resolver (D.3) must deploy **before** this lands.

### D.2 Backend batch signer (entitlement-aware)
- **`POST /api/v1/storage/signed-urls`** — `@UseGuards(OptionalAuthGuard)`, body `{ bucket, paths[] }`:
  - validate `bucket` ∈ allowlist, paths within expected prefixes (no traversal)
  - for premium prefixes (e.g. member/pack groove stems), resolve the owning content's tier via the resolver; deny paths the user can't access
  - return `{ [path]: signedUrl }` via `createSignedUrls(paths, ttl)`. **Batch** because `InitialSamplePreloader` resolves 10+ at startup.
- TTL proposal: **6h** (AudioBuffers are cached in `GlobalSampleCache` for the session regardless).
- Note: most audio-samples are *engine plumbing* (drum kits, instrument samples) needed by free users too — those map to `access_tier='free'`; only premium groove **stems** are gated. Tier the prefixes accordingly.

### D.3 Replace ~30 public-URL call sites with the signed resolver
The bulk of the mechanical work — **centralize to one chokepoint** so it's one change, not 30.
- Single async resolver (extend `AudioStorageService.getSampleUrl` / `SupabaseProvider`) → calls the batch signer, caches per session. Call sites consume the resolver.
- Sites: `InitialSamplePreloader.ts` (10: `995,1102,1207,1420,1559,1813,1917,2069,2153,2246`), `SupabaseProvider.ts:181,390-393`, `AudioStorageService.ts:148`, `SupabaseAssetClientFacade.ts:364-368`, `HarmonyPreloadStrategy.ts:883`; hand-built `/public/` strings (`AudioPlayer.tsx:46`, `useAssessmentAudioPreloader.ts:38`, `WamMetronome.ts:268-269`, `WamDrummer.ts:788`, `DrumPreloadStrategy.ts:192,200`, `MetronomePreloadStrategy.ts:30-31`, `AudioSampleManagerAdapter.ts:83`, `ExerciseLoader.ts:740,744`, `useRewardPreview.ts:74`, `useDrumEditorPlayback.ts:123`); **static manifests that bake the `/public/` prefix** (`bass-sampler-manifest.json:5`, `BassSampleManifest.ts:23`, `grand-piano.json`, `rhodes-piano.json`, `nice-keys-rhodes.json`, `wurlitzer-piano.json`, `LongPadSampler.ts:30`, `TheSawSampler.ts:30`, `data/drums/types.ts:107`, `wurlitzer/generate-config.ts:206`) → store **paths only**, resolve at load.

### D.4 Exercise MIDI (smaller)
- `GET /api/exercises/:id/download-midi` (`exercises.controller.ts:630`) is already `AuthGuard`-gated — swap `getPublicUrl('exercise-files',…)` at `:663` → `createSignedUrl`. Reroute the client-side `ExerciseLoader.ts:740,744` path through it.
- Sanitize the upload filename while here: `file-upload.service.ts:57` uses raw `file.originalname` (path-traversal); mirror `storage.controller.ts:204`.

### D.5 Waitlist demo carve-out (decided: separate public bucket)
- New **public `demo-grooves`** bucket; copy `economy-groove-1` stems; repoint `waitlistGrooveCard.config.ts:29`. Anon marketing demo keeps working; `audio-samples` goes private.

### D.6 Open items
- **Second Supabase host** — `LongPadSampler.ts:30`/`TheSawSampler.ts:30` point at a *different* project (`htuztkrbuewheehjspcz`). Confirm whether it's gated/legacy before touching.
- **Canonical exercise bucket** — confirm `exercise-files` vs `exercise-midi-files` (temp→permanent targets the latter).
- **CSP** — no change; `connect-src`/`media-src` already allow `https://*.supabase.co` (signed URLs are same-host).

---

## Rollout order (safe sequencing)

The danger: a window where buckets are private but the frontend still asks for public URLs (everything 400s). Also: enforcement must not ship before the entitlement model exists, or it'll over- or under-gate.

1. **Part A + B (entitlement foundation)** — products table, product-scoped purchases, content↔tier columns, `EntitlementService`. Additive, no user-visible change. Tiers 1+2 fully expressible; Tier 3 ready; Tier 4 enrollment table can defer.
2. **Part C (Bunny)** — independent, lowest blast radius, easy rollback (disable token-auth in dashboard). Ships Tiers 1/2/3 for video. *Own PR.*
3. **Part D.2 storage signer** (additive) → **D.3 frontend resolver still reading public buckets** (signed URLs work on public buckets too). Now the frontend no longer depends on public-URL construction.
4. **D.5 demo carve-out**, then **D.1 flip buckets private** — now a no-op for users, a real gate for attackers.
5. **D.4 exercise MIDI + filename sanitization.**
6. **Tier 4 Accelerator drip** — last, once a pack ships and the product/purchase loop is proven.

> Hard rule: never merge D.1 (bucket-private migration) ahead of D.3 (resolver deploy). And never ship C/D enforcement before A/B exists.

---

## Verification (ear-first + concrete-evidence, per CLAUDE.md)

- **Bunny:** anon → free video plays, member video iframe = **403** + upsell; subscriber → member video plays, un-owned pack video = **403**; pack buyer → pack video plays. Expired `expires` → 403.
- **Storage:** `curl …/object/public/audio-samples/<path>` → **400/404** after flip (was 200). Authenticated session → audio loads (Network tab shows `/object/sign/`, not `/object/public/`).
- **Entitlement matrix test** (the important one): a small table-driven test asserting `canAccessContent` for {anon, free-user, member, founder, pack-buyer, accelerator-day-3} × {free, member, pack, accelerator-day-1, accelerator-day-10} content. This is the security core — test it directly.
- **Full audio smoke:** logged-in groove end-to-end (drums+bass+harmony+metronome) — every signer path exercised; ear-check no missing stems.
- **Waitlist:** logged-out marketing groove demo still plays (demo-grooves).
- **Regression:** assert public bucket path returns non-200; assert anon `/rest/v1/groove_library` only returns `access_tier='free'` rows.

---

## Effort estimate (revised — bigger than the original "swap URLs" framing)

| Part | Size | Risk |
|---|---|---|
| A — Entitlement data model (products, purchases, content tiers) | **Large** (schema + migrations + Stripe/webhook wiring) | Medium — foundational; get it right once |
| B — Authorization resolver | Small–Medium | Low — but it's the security core; test hard |
| C — Bunny gating | Medium | Low — independent, dashboard rollback |
| D.1–D.2 — buckets private + storage signer | Small–Medium | **High** — migration sequencing is everything |
| D.3 — replace ~30 storage call sites | **Large** | Medium — centralize to one resolver to shrink |
| D.4 — exercise MIDI + filename | Small | Low |
| D.5 — demo carve-out | Small | Low |
| Tier 4 — accelerator drip | Medium | Low — deferrable |

**Suggested PR split:** (1) Entitlement model A+B. (2) Bunny gating C. (3) Storage signer D.2 + resolver D.3 (public buckets still). (4) Flip private D.1 + demo D.5. (5) Exercise MIDI D.4. (6) Accelerator drip. Each independently shippable; #1 unblocks everything else.

---

## Honest scoping note

The owner asked to "tackle the content-public problem." The investigation revealed it's entangled with an **unbuilt commerce feature** (Groove Packs / Accelerator products, LAUNCH-06/07 in the launch docs). Two ways to sequence:

- **Security-first (recommended):** Build A+B+C+D for **Tiers 1 & 2 only** (free vs member) — this closes the actual security hole today, since *all* current premium content is membership-gated. Add the `product` tier plumbing (columns, resolver branch) but mark it dormant until packs are built. This stops content theft now without waiting on the storefront.
- **Commerce-coupled:** Build the full 4-tier model including the Groove Pack / Accelerator storefront, checkout, and product catalog before flipping the gate on. Larger, slower, but ships packs and security together.

Recommendation: **security-first.** The hole is real now; the pack storefront is a separate roadmap item (LAUNCH-06/07). The plan above is structured so the `product` tier is a clean add-on, not a rewrite.
