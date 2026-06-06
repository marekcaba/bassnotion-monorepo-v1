import { supabase } from '@/infrastructure/supabase/client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface SignedVideoUrl {
  embedUrl: string;
  /** UNIX seconds at which the signed URL stops working. */
  expires: number;
}

export class VideoAccessError extends Error {
  constructor(
    message: string,
    readonly requiredTier?: string,
    readonly productId?: string,
  ) {
    super(message);
    this.name = 'VideoAccessError';
  }
}

/**
 * Attach the user's bearer token IF they're logged in. Unlike billing's
 * getAuthHeaders, this does NOT throw for anonymous callers — the video
 * playback-url endpoint is optionally-authenticated (free videos play
 * logged-out; member/product videos require a session).
 */
async function getOptionalAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // No session / supabase unavailable → proceed anonymously.
  }
  return headers;
}

/**
 * Fetch a short-lived, entitlement-checked Bunny embed URL for a video.
 * Throws VideoAccessError on 403 (caller shows an upsell), Error otherwise.
 *
 * @param libraryId optional hint for un-registered videos (the backend prefers
 *   the registered library when the video is in the registry).
 */
export async function fetchSignedVideoUrl(
  videoId: string,
  libraryId?: string,
): Promise<SignedVideoUrl> {
  const headers = await getOptionalAuthHeaders();
  const qs = libraryId ? `?libraryId=${encodeURIComponent(libraryId)}` : '';
  const response = await fetch(
    `${API_BASE_URL}/api/v1/videos/${encodeURIComponent(videoId)}/playback-url${qs}`,
    { method: 'GET', headers },
  );

  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw new VideoAccessError(
      body.message || 'You do not have access to this video',
      body.requiredTier,
      body.productId,
    );
  }

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(body.message || 'Failed to load video');
  }

  return response.json();
}
