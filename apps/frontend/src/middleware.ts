import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { refreshSession } from '@/infrastructure/supabase/middleware';

/**
 * Host-rewrite middleware for the app-subdomain migration + Supabase cookie-session refresh.
 *
 * On app.bassicology.com it serves the clean URL /gym off the internal folder
 * /app/gym (URL-preserving rewrite), keeps auth pages on the same origin
 * (single-origin auth — the Supabase session is a HOST-ONLY cookie on this origin),
 * and 308-bounces apex-only routes back to the apex. On the apex it 308s
 * /login,/register to the app subdomain and 308s legacy /app/* to the clean URL.
 *
 * Every terminal RENDER response (next()/rewrite()) is passed through refreshSession first, which
 * validates + refreshes the Supabase cookie session at the edge and writes any new token cookies
 * onto the response. The 308 redirects are intentionally NOT refreshed (Set-Cookie on a
 * cross-origin bounce is fragile, and those responses don't render).
 *
 * This is a NO-OP on any host not in APP_HOSTS (localhost, *.vercel.app preview),
 * so local dev and preview deploys are unaffected.
 *
 * See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 2).
 */

const APP_HOSTS = new Set([
  'app.bassicology.com',
  'app-staging.bassicology.com',
]);
const APP_ORIGIN = 'https://app.bassicology.com';
const APEX_ORIGIN = 'https://bassicology.com';

// Treat the app host AND local dev as "app hosts" so the clean-URL rewrites work
// in `pnpm dev` / PM2 too. Without this, localhost has no app host, so `/gym`
// 404s and `/app/*` gets 308'd to PRODUCTION — breaking local dev of the app.
function isLocalHost(host: string): boolean {
  const name = host.split(':')[0]; // strip the port
  return name === 'localhost' || name === '127.0.0.1' || name === '0.0.0.0';
}

function isAppHost(host: string): boolean {
  return APP_HOSTS.has(host) || isLocalHost(host);
}

// Served as-is on the app host (auth + api + assets). Auth pages MUST resolve on
// the app origin so the Supabase session cookie is written to app.bassicology.com.
const PASS_THROUGH = ['/login', '/register', '/auth', '/api', '/_next'];

// The ONLY clean paths the app host rewrites onto /app/*. Root '/' is handled
// separately; '/college' is the label alias for /app/bassment.
const APP_ROUTES = [
  '/backstage',
  '/gym',
  '/gigs',
  '/library', // the vault room (recordings / stem splitter / playlists) → /app/library
  '/settings',
  '/studio',
  '/welcome',
  '/store', // also covers /store/<slug> via the prefix check
  '/tutorials', // covers /tutorials/<slug>
];

// Apex-only routes that must bounce back to the apex if hit on the app host.
// Must include EVERY real top-level (non-/app) page — the fall-through below is
// an explicit 404, but listing them gives a clean 308 to the canonical host.
// NOTE: /library was HERE (the legacy v1 tutorial browser) — it's been removed and /library is now
// the in-app vault room (in APP_ROUTES above).
const APEX_ONLY = [
  '/pricing',
  '/dashboard',
  '/assessment',
  '/preview',
  '/free',
  '/founders',
  '/drum-record',
  '/admin',
  '/auth-demo',
];

const matchesPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

// The Supabase session cookie (see infrastructure/supabase — cookieOptions.name='sb-bn').
// @supabase/ssr chunks a large token into sb-bn.0 / sb-bn.1, so match the base name OR any chunk.
const AUTH_COOKIE_BASE = 'sb-bn';

// P2 edge gate: is an auth cookie PRESENT on the request? Deliberately a pure presence check —
// NOT a getUser() validation. Reasons:
//  - Zero edge latency / no network round-trip on every protected request.
//  - LOCKOUT-PROOF: a transient Auth-server outage can't 307 a logged-in user to /login (getUser
//    can't distinguish "no session" from "network down"; cookie-presence has no such ambiguity).
// The common case this kills is the logged-OUT load (no cookie → instant 307, no HTML shipped, no
// client-side flash). The rare present-but-expired cookie falls through to render and is handled by
// the client AuthGuard exactly as today. So this is purely additive: it can only turn a
// definitely-logged-out request away earlier; it never changes a logged-in request.
function hasAuthCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some(
      (c) => c.name === AUTH_COOKIE_BASE || c.name.startsWith(AUTH_COOKIE_BASE + '.'),
    );
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const { pathname, search } = req.nextUrl;

  // ---------- App subdomain (and local dev) ----------
  if (isAppHost(host)) {
    // Defensive: a stale /app/* link or a Stripe return → serve directly (the
    // double-prefix guard prevents /app/app/*). But P2-gate it first: a LOGGED-OUT
    // /app* hit must edge-307 to /login like every clean protected route, not serve
    // the shell and let the client AuthGuard bounce it (the split-second flash P2
    // kills). A logged-IN request (has the cookie) still serves directly, so Stripe
    // returns + valid deep links are untouched. Same same-origin /login as the gate below.
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      if (!isLocalHost(host) && !hasAuthCookie(req)) {
        const login = new URL('/login', req.url);
        login.searchParams.set('next', `${pathname}${search}`);
        return NextResponse.redirect(login, 307);
      }
      return await refreshSession(req, NextResponse.next());
    }

    // Auth / api / assets → as-is (single-origin auth).
    if (matchesPrefix(pathname, PASS_THROUGH)) {
      return await refreshSession(req, NextResponse.next());
    }

    // Apex-only routes → bounce to apex (never rewrite into a nonexistent /app/*).
    // EXCEPT on localhost: there's no apex/app split locally, so a 308 to
    // APEX_ORIGIN would punt /admin (and /library, /pricing, …) to PRODUCTION
    // and break local dev of those pages. On localhost serve them as-is.
    if (matchesPrefix(pathname, APEX_ONLY)) {
      if (isLocalHost(host)) return NextResponse.next();
      return NextResponse.redirect(
        new URL(`${APEX_ORIGIN}${pathname}${search}`),
        308,
      );
    }

    // P2 EDGE AUTH GATE. The KNOWN protected render paths are /college* and the
    // allow-listed APP_ROUTES (both rewrite to /app/* below). If there's NO auth cookie
    // the user is DEFINITELY logged out — 307 them to /login BEFORE any HTML ships,
    // instead of shipping the shell and letting the client-side AuthGuard resolve auth
    // and redirect (the flash we're killing). `next` lets /login send them back after
    // auth. 307 (temporary) not 308 — the path isn't moved.
    //
    // Scope note: this gates ONLY the protected routes. Unknown paths still hit the
    // explicit-404 fall-through below regardless of auth (typos/bots 404, they don't all
    // funnel to /login), and '/' redirects as before. Skipped on localhost: local dev has
    // no apex/app origin split and its own auth flow; gating there would bounce local /gym
    // to the PRODUCTION /login. PASS_THROUGH + APEX_ONLY are handled above (never gated).
    // A present-but-expired cookie intentionally falls through to render (AuthGuard handles it).
    const isProtectedRoute =
      pathname === '/college' ||
      pathname.startsWith('/college/') ||
      matchesPrefix(pathname, APP_ROUTES);
    if (isProtectedRoute && !isLocalHost(host) && !hasAuthCookie(req)) {
      // Redirect to /login on the SAME origin the request arrived on (req.url), NOT the hardcoded
      // APP_ORIGIN — otherwise a logged-out load on app-STAGING bounces to PRODUCTION login. The app
      // host serves /login on its own origin (PASS_THROUGH, single-origin auth), so same-origin is
      // correct on both app.bassicology.com and app-staging.bassicology.com. Mirrors the '/' →
      // /backstage redirect below, which builds from req.url for the same reason.
      const login = new URL('/login', req.url);
      login.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(login, 307);
    }

    // College room. Bare /college is the room landing (→ /app/bassment). A tutorial
    // opened FROM the College room is room-scoped — /college/<slug> serves the existing
    // tutorial page (→ /app/tutorials/<slug>), so the URL bar reads /college/<slug> while
    // the INTERNAL path stays /app/tutorials/<slug> (audio-provider + active-state checks
    // key on that, so they keep working unchanged). Any deeper /college/a/b path falls
    // back to the bassment folder.
    if (pathname === '/college') {
      const url = req.nextUrl.clone();
      url.pathname = '/app/bassment';
      return await refreshSession(req, NextResponse.rewrite(url));
    }
    const collegeSlug = pathname.match(/^\/college\/([^/]+)$/);
    if (collegeSlug) {
      const url = req.nextUrl.clone();
      url.pathname = `/app/tutorials/${collegeSlug[1]}`;
      return await refreshSession(req, NextResponse.rewrite(url));
    }
    if (pathname.startsWith('/college/')) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(/^\/college/, '/app/bassment');
      return await refreshSession(req, NextResponse.rewrite(url));
    }

    // Root → /backstage (the app's home room). The bare '/app' home is an empty placeholder
    // (constellation commented out), so we land on Backstage instead — which is also the menu
    // item that's already highlighted. A redirect (not a rewrite) so the URL bar reads /backstage.
    //
    // Build the target from req.url (the ACTUAL incoming request URL) — NOT req.nextUrl.clone(),
    // whose protocol can resolve to https on a dev/proxy request, producing an https://localhost
    // Location → ERR_SSL_PROTOCOL_ERROR on the http-only dev server. `new URL(path, req.url)`
    // inherits the real request origin (http on localhost, https in prod).
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/backstage', req.url));
    }

    // Allow-listed clean path → /app/<same>.
    if (matchesPrefix(pathname, APP_ROUTES)) {
      const url = req.nextUrl.clone();
      url.pathname = `/app${pathname}`;
      return await refreshSession(req, NextResponse.rewrite(url));
    }

    // Unknown path on the app host → EXPLICIT 404. Do NOT fall through to
    // NextResponse.next(): that is filesystem pass-through and would SERVE any
    // shared top-level route (e.g. /auth-demo) at 200 on the paid app host.
    // Rewrite to a ROOT-level non-existent path so Next renders the top-level
    // app/not-found.tsx (OUTSIDE the AuthGuard layout — so it 404s, not redirects).
    const notFound = req.nextUrl.clone();
    notFound.pathname = '/__not_found__';
    return await refreshSession(req, NextResponse.rewrite(notFound));
  }

  // ---------- Apex ----------
  // Single-origin auth: push apex login/register to the app subdomain so the
  // session cookie is never written to the apex origin. The apex serves only
  // PUBLIC pages (no session cookie here, since it's host-only to app.), so the
  // fall-through next() below is intentionally NOT wrapped in refreshSession —
  // there's nothing to refresh and we must not set an auth cookie on the apex.
  if (matchesPrefix(pathname, ['/login', '/register'])) {
    return NextResponse.redirect(
      new URL(`${APP_ORIGIN}${pathname}${search}`),
      308,
    );
  }

  // Legacy /app/* → clean subdomain URL (keep old bookmarks working).
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    const clean = pathname === '/app' ? '/' : pathname.replace(/^\/app/, '');
    return NextResponse.redirect(
      new URL(`${APP_ORIGIN}${clean}${search}`),
      308,
    );
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything EXCEPT static assets and Next internals (dotted paths and
  // _next are excluded, so robots.txt/sitemap.xml/images are untouched).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
