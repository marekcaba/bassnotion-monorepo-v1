import type {
  TutorialsResponse,
  TutorialResponse,
  TutorialExercisesResponse,
} from '@bassnotion/contracts';

import { supabase } from '@/infrastructure/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Optional auth header — attaches the session Bearer token IF the user is
 * logged in (does NOT throw for anon). The tutorials list/detail endpoints are
 * OptionalAuthGuard-gated: anon → free tutorials only; logged-in → their tier;
 * admin → all. Without this, the server can't tell who's asking and returns
 * free-only even to members/admins.
 */
async function optionalAuthHeader(): Promise<Record<string, string>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    return {};
  }
}

class TutorialsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
  ) {
    super(message);
    this.name = 'TutorialsApiError';
  }
}

async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TutorialsApiError(
        `API request failed: ${response.status} ${response.statusText}${
          errorText ? ` - ${errorText}` : ''
        }`,
        response.status,
        response,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TutorialsApiError) {
      throw error;
    }

    // Network or parsing errors
    throw new TutorialsApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Fetch all tutorials from the backend
 */
export async function fetchTutorials(): Promise<TutorialsResponse> {
  return fetchWithErrorHandling<TutorialsResponse>(
    `${API_BASE_URL}/tutorials`,
    {
      headers: await optionalAuthHeader(),
    },
  );
}

/** A DB-driven sidebar folder as returned by GET /collections. */
export interface CollectionView {
  id: string;
  slug: string;
  title: string;
  description?: string;
  accessTier: 'free' | 'member' | 'product';
  sortOrder: number;
  source: 'collection' | 'product';
  isLocked: boolean;
  /** Ordered tutorial ids; joined against the tutorials list on the client. */
  tutorialIds: string[];
}

export interface CollectionsResponse {
  collections: CollectionView[];
}

/**
 * Fetch the DB-driven sidebar folders. OptionalAuthGuard-gated like tutorials:
 * anon → free folders (locked teasers for the rest); logged-in → entitled
 * folders + virtual folders for owned packs; admin → all.
 */
export async function fetchCollections(): Promise<CollectionsResponse> {
  return fetchWithErrorHandling<CollectionsResponse>(
    `${API_BASE_URL}/collections`,
    { headers: await optionalAuthHeader() },
  );
}

/**
 * Fetch a specific tutorial by slug
 */
export async function fetchTutorialBySlug(
  slug: string,
): Promise<TutorialResponse> {
  if (!slug) {
    throw new TutorialsApiError('Tutorial slug is required');
  }

  return fetchWithErrorHandling<TutorialResponse>(
    `${API_BASE_URL}/tutorials/${encodeURIComponent(slug)}`,
    { headers: await optionalAuthHeader() },
  );
}

/**
 * Fetch tutorial with its related exercises
 */
export async function fetchTutorialExercises(
  slug: string,
): Promise<TutorialExercisesResponse> {
  if (!slug) {
    throw new TutorialsApiError('Tutorial slug is required');
  }

  const result = await fetchWithErrorHandling<TutorialExercisesResponse>(
    `${API_BASE_URL}/tutorials/${encodeURIComponent(slug)}/exercises`,
    { headers: await optionalAuthHeader() },
  );

  // DEBUG: Log exercise notes and MIDI URLs to trace data flow
  console.log('🔍 fetchTutorialExercises - API response:', {
    slug,
    exerciseCount: result.exercises?.length || 0,
    exercises: result.exercises?.map((ex: any) => ({
      id: ex.id,
      title: ex.title,
      notesCount: ex.notes?.length || 0,
      hasNotes: !!ex.notes,
      firstNote: ex.notes?.[0],
      // DEBUG: Check MIDI URLs from API
      drummerMidiUrl: ex.drummer_midi_url,
      basslineMidiUrl: ex.bassline_midi_url,
      harmonyMidiUrl: ex.harmony_midi_url,
      metronomeMidiUrl: ex.metronome_midi_url,
      // CRITICAL: Check if drum_pattern exists in API response
      hasDrumPattern: !!ex.drum_pattern,
      drumPatternLength: ex.drum_pattern?.length || 0,
      drumPatternSample: ex.drum_pattern?.[0],
      // CRITICAL: Check if harmony_notes exists in API response
      hasHarmonyNotes: !!ex.harmony_notes,
      harmonyNotesLength: ex.harmony_notes?.length || 0,
      harmonyInstrument: ex.harmony_instrument,
      harmonyNotesSample: ex.harmony_notes?.[0],
    })),
  });

  // DEBUG: Log creator data
  console.log('🔍 fetchTutorialExercises - Tutorial creator data:', {
    hasCreatorName: !!result.tutorial?.creator_name,
    creatorName: result.tutorial?.creator_name,
    hasCreatorAvatar: !!result.tutorial?.creator_avatar_url,
    creatorAvatar:
      result.tutorial?.creator_avatar_url?.substring(0, 60) + '...',
  });

  return result;
}

/**
 * Utility function to check if backend API is available
 */
export async function checkTutorialsApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/tutorials`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Export the error class for use in components
export { TutorialsApiError };
