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
  // Tutorials render a player at mount. Gym EQUIPMENT TOOLS (the leaf routes under
  // /app/gym/, e.g. /app/gym/scales) also render a player at mount — but the GYM
  // FLOOR itself (/app/gym, exact) must stay audio-free so it paints instantly. So we
  // match the /app/gym/ PREFIX (with trailing slash → leaves only), never the floor.
  //
  // GIGS follow the SAME split: a gig PERFORM page (/app/gigs/[goalSlug]/[gigId]) mounts the
  // ScalesTool player, so it needs the provider — but the /app/gigs LIST must stay light. So we
  // match the /app/gigs/ PREFIX (leaves only), never the list. (See gigs-page-load-architecture.)
  return (
    pathname.startsWith('/app/tutorials') ||
    pathname.startsWith('/app/gym/') ||
    pathname.startsWith('/app/gigs/')
  );
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
    // The gigs LIST: a tap opens a perform leaf that mounts the player, so warm the engine here
    // (after the light list paints) the same way the gym floor warms it for /gym/scales.
    pathname === '/app/gigs' ||
    // The splitter: split stems play here, but the player mounts on interaction, so the room stays
    // light and we warm the engine in the background after paint (like the gigs list).
    pathname === '/app/splitter' ||
    pathname === '/app/bassment' ||
    pathname.startsWith('/app/tutorials')
  );
}
