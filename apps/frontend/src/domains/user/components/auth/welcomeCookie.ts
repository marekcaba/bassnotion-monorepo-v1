/**
 * The one-shot post-login welcome cookie name. In a NEUTRAL (non-'use client') module so BOTH the
 * server reader (readWelcomeCookie via next/headers) and the client setter/clearer (justLoggedIn)
 * import it as a plain string.
 *
 * WHY this file exists: importing a value from a 'use client' module into a server module does NOT
 * give the raw value — Next's client-boundary transform turns client-module exports into client
 * reference PROXIES (functions). So the constant must live outside the client boundary, here.
 */
export const WELCOME_COOKIE = 'bn-welcome';
