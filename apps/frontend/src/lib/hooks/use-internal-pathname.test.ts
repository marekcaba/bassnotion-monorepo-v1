import { describe, it, expect } from 'vitest';
import { toInternalPathname } from './use-internal-pathname';

/**
 * The pure mapping behind useInternalPathname(): maps the clean browser path
 * (what usePathname() returns on the app subdomain after a host rewrite) back to
 * the INTERNAL /app/* tree the comparators are written against.
 */
describe('toInternalPathname', () => {
  it('maps root "/" to /app (Backstage home)', () => {
    expect(toInternalPathname('/')).toBe('/app');
  });

  it('prefixes /app onto a clean app-host path', () => {
    expect(toInternalPathname('/gym')).toBe('/app/gym');
    expect(toInternalPathname('/gigs')).toBe('/app/gigs');
    expect(toInternalPathname('/settings')).toBe('/app/settings');
    expect(toInternalPathname('/store')).toBe('/app/store');
    expect(toInternalPathname('/tutorials/come-together')).toBe(
      '/app/tutorials/come-together',
    );
  });

  it('maps the bare /college label alias to the /app/bassment folder', () => {
    expect(toInternalPathname('/college')).toBe('/app/bassment');
  });

  it('maps a room-scoped /college/<slug> to the shared tutorial page', () => {
    // A tutorial opened from the College room is /college/<slug>; the middleware serves
    // it off /app/tutorials/<slug>, so the comparator must see that (NOT /app/bassment/…)
    // or the card-active highlight + audio-provider gate break. Lockstep with middleware.
    expect(toInternalPathname('/college/serious-groove-card')).toBe(
      '/app/tutorials/serious-groove-card',
    );
  });

  it('maps a DEEPER /college/a/b path back to the bassment folder (fallback)', () => {
    expect(toInternalPathname('/college/a/b')).toBe('/app/bassment/a/b');
  });

  it('leaves an already-internal /app/* path unchanged (apex / SSR)', () => {
    expect(toInternalPathname('/app')).toBe('/app');
    expect(toInternalPathname('/app/gym')).toBe('/app/gym');
    expect(toInternalPathname('/app/tutorials/x')).toBe('/app/tutorials/x');
  });

  it('does NOT treat a top-level /apps or /app-store as already-prefixed', () => {
    // Boundary check: only exact /app or /app/* is "already internal".
    expect(toInternalPathname('/apps')).toBe('/app/apps');
    expect(toInternalPathname('/app-store')).toBe('/app/app-store');
  });

  it('Backstage exact-match: /gym does not collide with the /app root', () => {
    // Regression guard for the nav highlight: Backstage uses exactPatterns
    // ['/app']; the internal path of /gym is /app/gym, which is NOT === '/app'.
    expect(toInternalPathname('/gym')).not.toBe('/app');
  });
});
