/**
 * Absolute URL on the marketing/apex host (bassicology.com).
 *
 * Cross-product links from the app subdomain to apex routes (/pricing, /library)
 * must be ABSOLUTE apex URLs — a relative path on the app host would 308-bounce
 * (or 404). Falls back to a relative path when NEXT_PUBLIC_MARKETING_URL is unset
 * (local/preview with no subdomain split), so dev keeps working.
 *
 * See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 3.4 / Step 8).
 */
export function marketingUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_MARKETING_URL;
  if (!base) return path; // local/preview: same-origin relative path
  return `${base.replace(/\/$/, '')}${path}`;
}

/**
 * Navigate to a marketing/apex path. If marketingUrl() resolves to a different
 * origin than the current page (i.e. we're on the app subdomain), a client
 * transition can't cross origins, so do a full-page navigation. Otherwise use
 * the provided client-transition navigate fn (apex/local, same origin).
 */
export function navigateToMarketing(
  path: string,
  navigate: (url: string) => void,
): void {
  const url = marketingUrl(path);
  if (
    typeof window !== 'undefined' &&
    /^https?:\/\//.test(url) &&
    !url.startsWith(window.location.origin)
  ) {
    window.location.href = url;
    return;
  }
  navigate(url);
}

/**
 * Absolute URL on the APP host (app.bassicology.com) — the mirror of marketingUrl().
 *
 * Cross-product links FROM the apex (e.g. a public marketing page) TO an app route (/backstage) must
 * be ABSOLUTE app URLs — a relative path on the apex 404s (the app routes only exist on the app
 * host). Falls back to a relative path when NEXT_PUBLIC_APP_URL is unset (local/preview, no split).
 */
export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return path; // local/preview: same-origin relative path
  return `${base.replace(/\/$/, '')}${path}`;
}

/**
 * Navigate to an APP path. If appUrl() resolves to a different origin than the current page (i.e.
 * we're on the apex), a client transition can't cross origins → full-page navigation. Otherwise
 * (already on the app host / local) use the client-transition navigate fn.
 */
export function navigateToApp(
  path: string,
  navigate: (url: string) => void,
): void {
  const url = appUrl(path);
  if (
    typeof window !== 'undefined' &&
    /^https?:\/\//.test(url) &&
    !url.startsWith(window.location.origin)
  ) {
    window.location.href = url;
    return;
  }
  navigate(url);
}
