import { SplitterPageClient } from './SplitterPageClient';

/**
 * SERVER wrapper for /app/splitter (clean URL /splitter). The Splitter takes the member's own
 * recordings and separates them into stems — mute the bass and the recording becomes a backing
 * track to play over.
 *
 * LIGHT BY DESIGN (mirrors the gigs list): first paint is the room shell only — no audio engine.
 * Splitting + stem playback mount on interaction; the engine warms in the background after this
 * paints (routeCanReachAudio includes /app/splitter). Thin async server component; the room UI lives
 * in SplitterPageClient ('use client').
 */
export default function SplitterPage() {
  return <SplitterPageClient />;
}
