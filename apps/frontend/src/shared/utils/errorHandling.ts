/**
 * Shared error-handling utilities.
 *
 * Historically this module also defined a `GlobalErrorHandler` singleton that
 * installed its own `window` `unhandledrejection`/`error` listeners and reported
 * to Sentry via `Sentry.captureException`. That was REDUNDANT: `@sentry/nextjs`
 * already installs native global handlers (we don't disable defaultIntegrations),
 * so every unhandled error was captured twice — and the manual path bypassed the
 * `beforeSend`/`ignoreErrors` filters in sentry.client.config.ts (its inline
 * view-transition filter even matched the wrong string, "Transition was skipped"
 * vs the actual "Transition was aborted"). Removed 2026-06-13: Sentry's native
 * global capture is now the single path, and it honors the central filters.
 *
 * What remains is the `createStructuredLogger` re-export, which several playback
 * and storage modules import from here.
 */
export { createStructuredLogger } from '@bassnotion/contracts';
