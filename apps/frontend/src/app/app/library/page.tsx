import { LibraryPageClient } from './LibraryPageClient';

/**
 * SERVER wrapper for /app/library (clean URL /library). The Library is the member's VAULT — a 5th
 * room alongside Backstage / Gym / College / Gigs. It archives what they've made and gathers what
 * they play to: their recordings, an AI stem-splitter for tracks they upload, and their playlists +
 * platform-recommended music.
 *
 * LIGHT BY DESIGN (mirrors the gigs list): first paint is metadata + section shells only — no audio
 * engine, no player. Playback (recordings, split stems) mounts on interaction; the engine warms in
 * the background after this paints (routeCanReachAudio includes /app/library). Thin async server
 * component; the room UI lives in LibraryPageClient ('use client').
 */
export default function LibraryPage() {
  return <LibraryPageClient />;
}
