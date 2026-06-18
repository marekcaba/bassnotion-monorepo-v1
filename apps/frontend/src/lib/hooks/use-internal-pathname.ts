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
 * comparators see /app/bassment, not /app/college.
 *
 * See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 3 / "READ THIS FIRST part 2").
 */
export function useInternalPathname(): string {
  return toInternalPathname(usePathname());
}

/** Pure mapping — exported for tests and non-hook callers. */
export function toInternalPathname(pathname: string): string {
  if (pathname === '/') return '/app';

  // Label alias: the clean /college room serves the /app/bassment folder.
  if (pathname === '/college') return '/app/bassment';
  if (pathname.startsWith('/college/')) {
    return pathname.replace(/^\/college/, '/app/bassment');
  }

  // Already internal? Leave alone. Use a boundary so a future top-level /apps or
  // /app-store is NOT mistaken for an already-prefixed /app path.
  if (pathname === '/app' || pathname.startsWith('/app/')) return pathname;

  return `/app${pathname}`;
}
