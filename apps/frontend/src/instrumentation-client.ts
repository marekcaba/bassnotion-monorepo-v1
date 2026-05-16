/**
 * Next.js client-side instrumentation (Sentry v8+ convention).
 *
 * In @sentry/nextjs v8+ the old `sentry.client.config.ts` auto-discovery
 * was replaced by this file. Without it, the client-side SDK code ships
 * in the bundle but Sentry.init() never runs, so nothing gets captured.
 *
 * We delegate to the existing sentry.client.config.ts so all the
 * configuration (DSN, beforeSend, replay, ignoreErrors) stays in one place.
 *
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
import '../sentry.client.config';

/**
 * Forward client-side navigation transitions to Sentry. Required so the
 * browser SDK reports route changes in Next.js's app router. The actual
 * export name varies by SDK version — @sentry/nextjs 10.x exports
 * captureRouterTransitionStart and aliases it to onRouterTransitionStart
 * via Next.js's instrumentation hook contract.
 */
export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
