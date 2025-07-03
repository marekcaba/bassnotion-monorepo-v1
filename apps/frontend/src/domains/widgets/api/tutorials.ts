import type {
  TutorialsResponse,
  TutorialResponse,
  TutorialExercisesResponse,
} from '@bassnotion/contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

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
  return fetchWithErrorHandling<TutorialsResponse>(`${API_BASE_URL}/tutorials`);
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

  return fetchWithErrorHandling<TutorialExercisesResponse>(
    `${API_BASE_URL}/tutorials/${encodeURIComponent(slug)}/exercises`,
  );
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
