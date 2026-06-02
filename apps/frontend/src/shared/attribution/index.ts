/**
 * First-touch attribution for the waitlist page.
 *
 * Captures UTM params + first referrer + landing path + timezone on the
 * visitor's FIRST page load and persists them in localStorage for up to
 * 30 days. Subsequent visits do NOT overwrite the stored record — the
 * source that first brought the visitor wins.
 *
 * Sent alongside both the waitlist signup and the founder-interest click
 * so we can answer "which YouTube video / source / campaign drove this
 * signup."
 *
 * No third-party scripts, no cross-site cookies, no profile building —
 * stays a first-party measurement signal on our own database rows.
 *
 * GDPR posture: pragmatic pre-launch (no cookie banner). Revisit before
 * public launch when real EU traffic arrives.
 */

import type { Attribution } from '@bassnotion/contracts';
import { implicitWalls } from '@bassnotion/contracts';

const STORAGE_KEY = 'bn_attribution_v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type StoredAttribution = Attribution & { _expiresAt: number };

// Only the string-valued UTM fields go through this loop. Typed narrowly (not
// `keyof Attribution`) so `fresh[field] = string` type-checks now that
// Attribution also has the non-string `wall` union.
type UtmField =
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'utmContent'
  | 'utmTerm';

const UTM_KEYS: Array<{ param: string; field: UtmField }> = [
  { param: 'utm_source', field: 'utmSource' },
  { param: 'utm_medium', field: 'utmMedium' },
  { param: 'utm_campaign', field: 'utmCampaign' },
  { param: 'utm_content', field: 'utmContent' },
  { param: 'utm_term', field: 'utmTerm' },
];

function readStored(): StoredAttribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed._expiresAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() > parsed._expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    // localStorage may be blocked (private mode, security settings).
    // Attribution is best-effort; never crash the page over it.
    return null;
  }
}

function captureFresh(): Attribution {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const fresh: Attribution = {};

  for (const { param, field } of UTM_KEYS) {
    const value = params.get(param);
    if (value && value.length > 0) {
      // Trim length defensively — we cap at 120 chars in the schema too.
      fresh[field] = value.slice(0, 120);
    }
  }

  // Door identifiers on links we control (e.g. a YouTube description link
  // `?src=yt&vid=funk-ghost&wall=depth`). `vid` is our own slug, not YouTube's
  // raw id. These pre-load the matched-offer segment downstream.
  const src = params.get('src');
  if (src && src.length > 0) fresh.src = src.slice(0, 40);

  const vid = params.get('vid');
  if (vid && vid.length > 0) fresh.vid = vid.slice(0, 120);

  // `wall` is constrained to the three known segments; drop anything else
  // rather than store a junk value that would fail the strict schema.
  const wall = params.get('wall');
  if (wall && (implicitWalls as readonly string[]).includes(wall)) {
    fresh.wall = wall as Attribution['wall'];
  }

  // document.referrer is the URL of the page the visitor came FROM.
  // When the visitor lands on bassicology.com from a YouTube video,
  // this is youtube.com (or m.youtube.com on mobile).
  if (document.referrer && document.referrer.length > 0) {
    fresh.referrer = document.referrer.slice(0, 2048);
  }

  if (window.location.pathname) {
    fresh.landingPath = window.location.pathname.slice(0, 2048);
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) fresh.timezone = tz.slice(0, 80);
  } catch {
    // resolvedOptions().timeZone can throw in some sandboxed contexts.
  }

  fresh.capturedAt = new Date().toISOString();

  return fresh;
}

/**
 * Run once on page mount. If a first-touch record already exists in
 * localStorage (within TTL), returns it untouched. Otherwise captures
 * current context and stores it.
 *
 * Returns the attribution payload to send with subsequent API calls.
 * Returns an empty object if storage is unavailable or no signals can
 * be captured — never throws.
 */
export function ensureFirstTouchAttribution(): Attribution {
  if (typeof window === 'undefined') return {};

  const existing = readStored();
  if (existing) {
    const { _expiresAt, ...attribution } = existing;
    void _expiresAt;
    return attribution;
  }

  const fresh = captureFresh();
  if (Object.keys(fresh).length === 0) return fresh;

  try {
    const payload: StoredAttribution = {
      ...fresh,
      _expiresAt: Date.now() + TTL_MS,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Same as readStored — storage failures are non-fatal.
  }

  return fresh;
}

/**
 * Read the persisted attribution without re-capturing. Useful for form
 * submits after the initial page-mount capture has run.
 */
export function getStoredAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  const stored = readStored();
  if (!stored) return {};
  const { _expiresAt, ...attribution } = stored;
  void _expiresAt;
  return attribution;
}
