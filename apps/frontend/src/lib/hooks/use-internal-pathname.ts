'use client';

import { usePathname } from 'next/navigation';

/**
 * Maps the browser pathname to the INTERNAL /app/* route tree.
 *
 * On the app subdomain (app.bassicology.com) the host-rewrite middleware serves
 * the clean URL /gym off the internal folder /app/gym, and `usePathname()`
 * returns the CLEAN browser path (/gym) on the client. All of our nav-highlight,
 * detail-panel and admin-gate comparisons are written against the internal
 * /app/* tree, so this hook maps the clean path back to it. On the apex (and for
 * any path already under /app) the transform is harmless — no comparator mounts
 * on the apex marketing surface.
 *
 * The /college room is the one label whose clean URL differs from its folder
 * (/college serves /app/bassment); this mirrors the middleware's alias rewrite so
 * comparators see /app/bassment, not /app/college. A tutorial opened from the College
 * room is room-scoped (/college/<slug>) and the middleware serves it off the shared
 * tutorial page, so /college/<slug> maps to /app/tutorials/<slug> here too — this MUST
 * stay in lockstep with the middleware's /college rules.
 *
 * See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 3 / "READ THIS FIRST part 2").
 */
export function useInternalPathname(): string {
  return toInternalPathname(usePathname());
}

/** Pure mapping — exported for tests and non-hook callers.
 *  KEEP IN LOCKSTEP with the /college rules in middleware.ts. */
export function toInternalPathname(pathname: string): string {
  if (pathname === '/') return '/app';

  // College room. Bare /college is the room landing (→ /app/bassment). A room-scoped
  // tutorial /college/<slug> serves the shared tutorial page (→ /app/tutorials/<slug>),
  // so active-state comparators (keyed on /app/tutorials) match. Deeper paths fall back
  // to the bassment folder. Mirrors middleware.ts exactly.
  if (pathname === '/college') return '/app/bassment';
  const collegeSlug = pathname.match(/^\/college\/([^/]+)$/);
  if (collegeSlug) return `/app/tutorials/${collegeSlug[1]}`;
  if (pathname.startsWith('/college/')) {
    return pathname.replace(/^\/college/, '/app/bassment');
  }

  // Already internal? Leave alone. Use a boundary so a future top-level /apps or
  // /app-store is NOT mistaken for an already-prefixed /app path.
  if (pathname === '/app' || pathname.startsWith('/app/')) return pathname;

  return `/app${pathname}`;
}
