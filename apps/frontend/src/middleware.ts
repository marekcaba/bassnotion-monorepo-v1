import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Host-rewrite middleware for the app-subdomain migration.
 *
 * On app.bassicology.com it serves the clean URL /gym off the internal folder
 * /app/gym (URL-preserving rewrite), keeps auth pages on the same origin
 * (single-origin auth — the Supabase session is localStorage, origin-scoped),
 * and 308-bounces apex-only routes back to the apex. On the apex it 308s
 * /login,/register to the app subdomain and 308s legacy /app/* to the clean URL.
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
function isAppHost(host: string): boolean {
  if (APP_HOSTS.has(host)) return true;
  const name = host.split(':')[0]; // strip the port
  return name === 'localhost' || name === '127.0.0.1' || name === '0.0.0.0';
}

// Served as-is on the app host (auth + api + assets). Auth pages MUST resolve on
// the app origin so the Supabase session is written to app.bassicology.com.
const PASS_THROUGH = ['/login', '/register', '/auth', '/api', '/_next'];

// The ONLY clean paths the app host rewrites onto /app/*. Root '/' is handled
// separately; '/college' is the label alias for /app/bassment.
const APP_ROUTES = [
  '/backstage',
  '/gym',
  '/gigs',
  '/settings',
  '/studio',
  '/welcome',
  '/store', // also covers /store/<slug> via the prefix check
  '/tutorials', // covers /tutorials/<slug>
];

// Apex-only routes that must bounce back to the apex if hit on the app host.
// Must include EVERY real top-level (non-/app) page — the fall-through below is
// an explicit 404, but listing them gives a clean 308 to the canonical host.
const APEX_ONLY = [
  '/library',
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

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const { pathname, search } = req.nextUrl;

  // ---------- App subdomain (and local dev) ----------
  if (isAppHost(host)) {
    // Defensive: a stale /app/* link or a Stripe return → serve directly (the
    // double-prefix guard prevents /app/app/*).
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return NextResponse.next();
    }

    // Auth / api / assets → as-is (single-origin auth).
    if (matchesPrefix(pathname, PASS_THROUGH)) {
      return NextResponse.next();
    }

    // Apex-only routes → bounce to apex (never rewrite into a nonexistent /app/*).
    if (matchesPrefix(pathname, APEX_ONLY)) {
      return NextResponse.redirect(
        new URL(`${APEX_ORIGIN}${pathname}${search}`),
        308,
      );
    }

    // Label alias: /college → /app/bassment.
    if (pathname === '/college' || pathname.startsWith('/college/')) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(/^\/college/, '/app/bassment');
      return NextResponse.rewrite(url);
    }

    // Root → /app ; allow-listed clean path → /app/<same>.
    if (pathname === '/' || matchesPrefix(pathname, APP_ROUTES)) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === '/' ? '/app' : `/app${pathname}`;
      return NextResponse.rewrite(url);
    }

    // Unknown path on the app host → EXPLICIT 404. Do NOT fall through to
    // NextResponse.next(): that is filesystem pass-through and would SERVE any
    // shared top-level route (e.g. /auth-demo) at 200 on the paid app host.
    // Rewrite to a ROOT-level non-existent path so Next renders the top-level
    // app/not-found.tsx (OUTSIDE the AuthGuard layout — so it 404s, not redirects).
    const notFound = req.nextUrl.clone();
    notFound.pathname = '/__not_found__';
    return NextResponse.rewrite(notFound);
  }

  // ---------- Apex ----------
  // Single-origin auth: push apex login/register to the app subdomain so the
  // session is never written to the apex origin's localStorage.
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
