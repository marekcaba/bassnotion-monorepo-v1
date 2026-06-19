/**
 * Routes where a player renders AT MOUNT, so <AudioProvider> must be mounted
 * (and its engine chunk fetched) on first paint.
 *
 * This is DELIBERATELY tighter than the warm-up set. The GYM is excluded: its
 * first paint is the overlay + floor chooser (both audio-free, verified), and
 * the player only mounts at the drill 'running' phase via DrillSessionFrame's
 * dynamic import. So the gym overlay must NOT pull the engine — the background
 * warm-up + the ensureAudioReady() kick at drill-Start cover it. Tutorials
 * render the player at mount (non-drill branch) so they DO need the provider.
 */
export function routeNeedsAudioProvider(pathname: string): boolean {
  return pathname.startsWith('/app/tutorials');
}

/**
 * Routes from which the user can REACH audio (a superset of the above). Used to
 * schedule the background warm-up after paint — so the engine is already hot in
 * the WindowRegistry singleton by the time the user starts a drill / opens a
 * player, without ever blocking the overlay/floor/landing paint.
 */
export function routeCanReachAudio(pathname: string): boolean {
  return (
    pathname === '/app/gym' ||
    pathname === '/app/bassment' ||
    pathname.startsWith('/app/tutorials')
  );
}
