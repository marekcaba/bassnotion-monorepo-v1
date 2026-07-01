import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchQueries } from '@/lib/server/prefetchQueries';
import { GymScalesPageClient } from './GymScalesPageClient';

/**
 * SERVER wrapper for /app/gym/scales (full-SSR). The tool sizes its fretboard from the user's bass
 * config (useUserProfile → ['user-profile', userId], read-only GET /api/user/profile). Prefetch it
 * server-side + hydrate so the board renders with the RIGHT string-count/fret-count on first paint
 * (no 4-string default → user-config snap).
 *
 * The profile endpoint wraps its body in {success,data} and the client hook caches result.DATA — so
 * the transform below unwraps the same shape (seed the raw envelope and the client reads undefined).
 * Audio is safe: ScalesTool's engine mounts via the shell's dynamic(ssr:false) AudioProvider, never
 * server-side. prefetchQueries never throws — logged out / hiccup → the tool falls back to defaults.
 */
export default async function GymScalesPage() {
  const { dehydratedState } = await prefetchQueries([
    {
      key: (userId) => ['user-profile', userId],
      path: '/api/user/profile',
      transform: (raw) => {
        const r = raw as { success?: boolean; data?: unknown } | null;
        return r && r.success && r.data ? r.data : null;
      },
    },
  ]);

  return (
    <HydrationBoundary state={dehydratedState}>
      <GymScalesPageClient />
    </HydrationBoundary>
  );
}
