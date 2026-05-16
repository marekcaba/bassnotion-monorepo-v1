/**
 * Next.js instrumentation hook (13.4+).
 *
 * Loads the right Sentry config for the runtime that just booted. The
 * client config is loaded automatically by withSentryConfig in
 * next.config.js — this file only handles the server + edge runtimes.
 *
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Forward React Server Component request errors to Sentry. Required for
 * Sentry to capture errors thrown inside `app/` Server Components and
 * server actions.
 */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
