/**
 * Drill constants.
 *
 * A drill IS a tutorial — a normal tutorial row whose blocks are 3-4
 * groove-card bricks (each tagged with a `role` + `timeboxMinutes`). It renders
 * through the existing tutorial route (/app/tutorials/[slug]) and player, which
 * already sequences blocks, gates skip-ahead, and shows the progress rail.
 * There is no separate drill environment.
 *
 * `DRILL_SESSION_SLUG` is the starter session the /app "Start the drill"
 * button points at (→ /app/tutorials/drill-session). Phase 2 ("the Timer
 * assembles your manual") will pick the slug from the user's level instead of
 * a constant.
 */
export const DRILL_SESSION_SLUG = 'drill-session';
