import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

/**
 * Host-aware robots. Reading the host via headers() makes this dynamic, which is
 * what lets it vary per host (the default static robots() cannot). On the app
 * subdomain the entire member surface is disallowed; on the apex the normal
 * marketing rules apply (carried over from the deleted public/robots.txt).
 * See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 9).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? '';
  const isAppHost = host.startsWith('app.') || host.startsWith('app-staging.');

  if (isAppHost) {
    // The paid member surface must never be indexed.
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Carried over from the deleted public/robots.txt (all 13 + auth).
        disallow: [
          '/admin/',
          '/debug/',
          '/api/',
          '/auth/callback',
          '/test-',
          '/diagnose-',
          '/detect-',
          '/fix-',
          '/emergency-',
          '/identify-',
          '/remove-',
          '/safe-',
          '/click-',
          '/disable-',
        ],
      },
    ],
  };
}
