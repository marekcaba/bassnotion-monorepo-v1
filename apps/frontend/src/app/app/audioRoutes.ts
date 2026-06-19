/**
 * Which INTERNAL /app/* routes can actually reach audio playback.
 *
 * Used to (a) conditionally MOUNT <AudioProvider> only on these routes so the
 * 232KB audio-engine chunk is never fetched on audio-free pages
 * (gigs/college-landing/settings/backstage/store/welcome), and (b) gate the
 * background warm-up. Single source of truth for both.
 *
 * Note: /app/bassment (College) is included because its deep tutorial surface
 * embeds the player; the landing itself is light but the route can reach audio.
 */
export function routeCanReachAudio(pathname: string): boolean {
  return (
    pathname === '/app/gym' ||
    pathname === '/app/bassment' ||
    pathname.startsWith('/app/tutorials')
  );
}
