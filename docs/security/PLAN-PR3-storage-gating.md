# PR 3 — Supabase Storage Gating (revised after investigation)

**Status:** Planning · **Created:** 2026-06-06
**Depends on:** PR1 (EntitlementService, `groove_library.access_tier`/`product_id`) ✅ shipped, PR2 (the videos.controller signing pattern to mirror) ✅ shipped.

---

## The key finding that reshapes this PR

The original plan (in PLAN-content-access-gating.md / PLAN-entitlements-and-commerce.md) said: *make `audio-samples`, `exercise-files`, `exercise-midi-files`, `patterns` private + rewrite ~30 call sites + migrate 5 baked JSON manifests.*

**Investigation shows that's the wrong move.** Most of `audio-samples` is **universal engine plumbing**, not premium content:

| Prefix in `audio-samples` | Nature | Who needs it |
|---|---|---|
| `drums/`, `bass/`, `Keyboards/`, `Pianos/`, pad/saw sample sets | Instrument samples — the card can't make ANY sound without them | **Everyone, incl. anon/free** |
| `metronome/`, `silence.ogg` | Count-in, metronome, engine filler | Everyone |
| `assessment/` | Assessment audio | Everyone (currently) |
| **`grooves/{slug}/{key}/{stem}.ogg`** | **Per-groove stems — the actual sellable content** | **Gateable** ← the only premium thing |
| `grooves/economy-groove-1/e/*` | The waitlist demo groove | Must stay public (anon marketing) |

Making the whole bucket private would break the app for free users, detonate ~20 call sites + 5 baked JSON manifests + 2 stale-ref samplers — **all to lock down plumbing that was never secret.** That's effort and risk with negative value.

**The surgical truth:** the only storage content worth gating is the **groove stems**, and `groove_library.access_tier`/`product_id` already exist exactly to gate them. So PR 3 becomes small and focused, mirroring the PR2 video pattern.

---

## The groove access model (confirmed with owner)

Two kinds of grooves today (the `product` tier stays dormant until a storefront exists):

| Groove type | `access_tier` | Stems live in | Who plays | Cadence |
|---|---|---|---|---|
| **Free** (one new every week) | `free` (the default) | public `audio-samples` | everyone, incl. anon | weekly drop |
| **Member** (behind the paywall) | `member` | **private `groove-stems`** | active members/founders only | the locked library |

- Publishing the **weekly free groove** = a `free` row (or just the default) → public stems, no signing, anon plays it. No security work per drop.
- Locking a groove to **members** = set its row to `access_tier='member'` and put its stems in the private bucket → the signer enforces it.
- `product` (Groove Pack / Accelerator) = built but dormant; needs the storefront before use.

**Rollout is zero-impact:** every current groove is `free`, so shipping the mechanism changes nothing for users. You flip a groove to `member` only when you have one to lock.

## Scope decision: gate groove stems only

**In scope (PR 3):**
- Gate `grooves/` premium stems behind `EntitlementService.canAccessContent` using `groove_library.access_tier`/`product_id` (already in the schema, not yet enforced anywhere).
- A backend signer endpoint that returns signed stem URLs after an entitlement check — mirroring `videos.controller.ts`.
- The grooves API / `useGrooveCardStemPreload` consume signed URLs for non-free grooves; free grooves + the waitlist demo + ALL instrument plumbing stay on public URLs.

**Deliberately NOT in scope (and why):**
- ❌ Making `audio-samples` fully private — breaks free users; the instrument samples aren't secret.
- ❌ Rewriting the ~20 instrument-sample call sites + 5 JSON manifests — they serve plumbing.
- ❌ `exercise-files` / `exercise-midi-files` / `patterns` gating — exercise MIDI is low-value-to-steal and auth-gated already at the download endpoint; patterns are a library. (Can revisit, but not the priority.)
- ⚠️ `avatars`, `tutorial-thumbnails` — stay public by design.

> If exercise/pattern gating is wanted later, it's a separate small follow-up. The HIGH-value, low-risk win is groove stems.

---

## How groove stems work today (the problem)

1. `groove_library.stems` JSONB stores **full public URLs** (`…/storage/v1/object/public/audio-samples/grooves/{slug}/{key}/{stem}.ogg`). A Zod regex (`groove-card-block.schema.ts:24-43`) even *enforces* the full-public-URL shape.
2. Frontend reads them via `useGroove` → `GrooveCardBlockView` → `useGrooveCardStemPreload` → raw `fetch(url)` + `decodeAudioData`.
3. `access_tier` exists on the row but is **read by nothing** — grooves are public-read of all active rows.

So: every groove's stems are world-fetchable by URL today, and the tier column is dormant.

---

## The two architectural options

### Option A — Keep `audio-samples` public; gate by serving signed URLs only for premium grooves, and DON'T store premium stems publicly
Problem: if premium stems live in the public `audio-samples` bucket, signing is pointless — the public URL still works. So premium stems must NOT be publicly reachable. That means either (A1) a separate **private** bucket for premium stems, or (A2) making `audio-samples` private (rejected above).

### Option B — New private `groove-stems` bucket for premium stems (RECOMMENDED)
- Create a **private** `groove-stems` bucket.
- Premium groove stems live there; free groove stems + demo + all plumbing stay in public `audio-samples`.
- `groove_library.stems` stores **object paths** (or full private URLs) for premium grooves; the backend signs them per entitled user.
- Free grooves keep public URLs in `audio-samples` (no signing, no entitlement round-trip — anon can play them).

**Why B:** clean separation, no risk to the engine plumbing, free content stays zero-latency-public, and "is this stem premium?" is answered by *which bucket / which tier* rather than scattering logic. Matches the videos model (registry row decides tier; backend signs).

---

## Implementation (Option B)

### B.1 Private bucket + demo carve-out
- Migration: create **private** `groove-stems` bucket (admin-write, no public read; service-role signs).
- Create **public** `demo-grooves` bucket; copy `economy-groove-1` stems there; repoint `waitlistGrooveCard.config.ts:28-33,65-66`. (This is the long-standing waitlist carve-out item.)

### B.2 Stem storage model
- `groove_library` gains a clear contract: for `access_tier='free'` → `stems` hold public `audio-samples` URLs (unchanged). For `access_tier IN ('member','product')` → `stems` hold `groove-stems` **object paths** (not public URLs).
- Relax/branch the Zod `STEM_PATH_REGEX` (`groove-card-block.schema.ts:24-43`) to accept both shapes by tier.

### B.3 Backend signer endpoint (mirror videos.controller.ts)
- `GET /api/v1/grooves/:grooveId/stem-urls` (or extend the grooves controller):
  - `OptionalAuthGuard`
  - load groove → `{access_tier, product_id}`
  - `EntitlementService.canAccessContent(userId, groove)` → 403 if denied
  - free → return the public URLs as-is (or skip signing)
  - member/product → `createSignedUrls(stemPaths, ttl)` against `groove-stems`, return signed URLs
- TTL ~6h (matches the videos signer; stems are decoded-and-cached for the session).

### B.4 Frontend consumes signed stem URLs
- `useGroove` / `grooveLibraryApi.get` → for non-free grooves, fetch stem URLs from the signer endpoint instead of reading `stems` directly.
- `useGrooveCardStemPreload` already does `fetch(url)+decodeAudioData` — it just receives signed URLs now. On 403 → show the lock/upsell (entitlement UX already anticipates this: "Drill the layers with a Groove Pack").
- Free grooves: unchanged (public URLs straight from `stems`).

### B.5 Tighten groove_library RLS (optional, defense-in-depth)
- Public-read only `access_tier='free'` rows; member/product rows resolved server-side. (Don't leak premium groove existence to anon beyond an intentional teaser.) Do this in the same PR as the signer so listing endpoints don't break.

---

## What this PR does NOT change (reassurance)
- The groove card still plays for everyone — all instrument samples stay public.
- Free grooves play for anon, zero added latency.
- No JSON manifests touched, no ~20 plumbing call sites rewritten.
- Only premium groove stems become gated, via the same battle-tested pattern as videos.

---

## ⚠️ The same caveat as video packs

Like PR2's `product` tier: the **gate works**, but **you can't sell yet** (no storefront). So in practice:
- `access_tier='member'` grooves → **fully usable today** (members exist).
- `access_tier='product'` grooves → gate works, but needs the storefront before anyone can buy access.

And critically: **migrating existing premium stems into the private bucket + flipping the contract is the risky step** — sequence it so the frontend signer-consumption ships before any stem is moved out of public reach (same rule as PR2: enforcement code deploys before the lockdown).

---

## Rollout order
1. Backend signer endpoint + frontend consumption (additive; free grooves unaffected; premium grooves still public until moved).
2. `demo-grooves` bucket + waitlist repoint.
3. Create private `groove-stems` bucket; move a premium groove's stems there + set its row to `member`/`product` + path-form stems. Verify: member plays, anon/non-member 403.
4. RLS tightening on `groove_library` (optional).

> Hard rule (same as PR2): never move stems out of public reach before the signer-consumption frontend is deployed.

---

## Effort estimate
| Part | Size | Risk |
|---|---|---|
| B.3 signer endpoint (mirror videos) | Small | Low |
| B.4 frontend consumption | Small–Medium | Low (free path untouched) |
| B.1 buckets + demo carve-out | Small | Medium (demo must not break) |
| B.2 stem contract + Zod | Small | Low |
| B.5 RLS tighten | Small | Low |

**Much smaller than the original PR3 framing** — because we correctly scoped it to the only thing worth gating.

---

## Open questions for the user
1. **Confirm scope:** gate ONLY groove stems now (recommended), leaving exercise MIDI / patterns public for a later follow-up? Or include those too?
2. **Any premium grooves exist yet?** If all current grooves are free, PR3 can ship the *mechanism* (endpoint + bucket + consumption) dormant, and you flip a groove to `member`/`product` when you actually have premium stems — zero user impact on rollout (same dormant-but-ready approach as the video registry).
3. **Demo bucket:** confirm the `demo-grooves` public-bucket carve-out for the waitlist (vs. keeping just the `economy-groove-1` prefix public somehow).
