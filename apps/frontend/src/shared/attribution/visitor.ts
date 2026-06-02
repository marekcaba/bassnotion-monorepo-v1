/**
 * Anonymous visitor identity — the join-key spine.
 *
 * On the FIRST visit to ANY page we mint a random id and persist it in a
 * first-party cookie (bn_anonymous_id). It is anonymous (no PII) and stable
 * across visits, so it ties together every funnel_events row for this browser
 * and — once accounts exist — gets stitched to the real user_id at signup.
 *
 * First-party + SameSite=Lax survives Safari ITP far better than any cross-site
 * pixel. Best-effort throughout: if cookies are blocked we fall back to an
 * in-memory id for the session and never throw.
 */

import { generateCorrelationId } from '@bassnotion/contracts';

const COOKIE_NAME = 'bn_anonymous_id';
const TWO_YEARS_SECONDS = 2 * 365 * 24 * 60 * 60; // 63072000

// Last resort when cookies are unavailable (private mode, blocked storage).
// Stable for the page's lifetime so events within one load still correlate.
let memoryFallbackId: string | null = null;

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name + '=([^;]*)'),
    );
    return match && match[1] !== undefined
      ? decodeURIComponent(match[1])
      : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${name}=${encodeURIComponent(value)}` +
      `; Max-Age=${TWO_YEARS_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookie write failed — caller falls back to the in-memory id.
  }
}

/**
 * Return this browser's anonymous id, minting + persisting one on first call.
 * Safe to call on every page; reads the existing cookie when present.
 * Returns an empty string only during SSR (no document).
 */
export function ensureAnonymousId(): string {
  if (typeof document === 'undefined') return '';

  const existing = readCookie(COOKIE_NAME);
  if (existing) return existing;

  const id = generateCorrelationId(); // valid uuid v4 (or polyfill)
  writeCookie(COOKIE_NAME, id);

  // If the cookie didn't actually stick (blocked), keep a stable in-memory id
  // so events within this load still share one identity.
  if (!readCookie(COOKIE_NAME)) {
    memoryFallbackId = memoryFallbackId ?? id;
    return memoryFallbackId;
  }

  return id;
}
