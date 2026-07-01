import type { Gig } from '@bassnotion/contracts';
import { getServerAuth } from '@/lib/server/serverAuth';
import { serverFetchJson } from '@/lib/server/serverFetch';
import { GigsPageClient } from './GigsPageClient';

/**
 * SERVER wrapper for /app/gigs (full-SSR). Reads the gig list (read-only GET) server-side and hands
 * the client tree `initialGigs`, so the list is on the page on first paint — no "Loading…" flash.
 * Never throws / never mutates: on any hiccup initialGigs is null and the client resolves it live.
 *
 * Mirrors fetchMyGigs' unwrap of the { gigs } envelope. The heavy gig-list UI stays in
 * GigsPageClient ('use client'); this stays a thin async server component.
 */
export default async function GigsPage() {
  const { token } = await getServerAuth();
  const res = token
    ? await serverFetchJson<{ gigs: Gig[] }>(
        '/api/v1/training-engine/recordings/gigs',
        token,
      )
    : null;
  return <GigsPageClient initialGigs={res ? res.gigs : null} />;
}
