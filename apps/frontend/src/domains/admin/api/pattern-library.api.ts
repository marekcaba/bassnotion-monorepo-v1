/**
 * Pattern Library API Client
 * Handles all communication with the pattern library backend endpoints
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  PatternLibraryFilter,
  PatternLibraryResponse,
  PatternLibraryItem,
  CreatePatternInput,
} from '@bassnotion/contracts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Singleton Supabase client to prevent "Multiple GoTrueClient instances" warning
 */
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return supabaseClient;
}

/**
 * Get authorization header with current user's token (optional for pattern library)
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Build query string from filter object
 */
function buildQueryString(filter: PatternLibraryFilter): string {
  const params = new URLSearchParams();

  if (filter.genre) params.append('genre', filter.genre);
  if (filter.difficulty) params.append('difficulty', filter.difficulty);
  if (filter.timeSignatureNumerator)
    params.append(
      'timeSignatureNumerator',
      String(filter.timeSignatureNumerator),
    );
  if (filter.timeSignatureDenominator)
    params.append(
      'timeSignatureDenominator',
      String(filter.timeSignatureDenominator),
    );
  if (filter.bars) params.append('bars', String(filter.bars));
  if (filter.bpm) params.append('bpm', String(filter.bpm));
  if (filter.search) params.append('search', filter.search);
  if (filter.tags && filter.tags.length > 0)
    params.append('tags', filter.tags.join(','));
  if (filter.featured !== undefined)
    params.append('featured', String(filter.featured));
  if (filter.sortBy) params.append('sortBy', filter.sortBy);
  if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);
  if (filter.page) params.append('page', String(filter.page));
  if (filter.limit) params.append('limit', String(filter.limit));

  return params.toString();
}

/**
 * Pattern Library API methods
 */
export const patternLibraryApi = {
  /**
   * Get patterns from the library with optional filtering
   * Public endpoint - no auth required
   */
  async getPatterns(
    filter: PatternLibraryFilter = {},
  ): Promise<PatternLibraryResponse> {
    const queryString = buildQueryString(filter);
    const url = `${API_BASE_URL}/api/v1/patterns/library${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to fetch patterns');
    }

    return response.json();
  },

  /**
   * Get a single pattern by ID
   * Public endpoint - no auth required
   */
  async getPattern(id: string): Promise<PatternLibraryItem> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/patterns/library/${id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to fetch pattern');
    }

    const data = await response.json();
    return data.pattern;
  },

  /**
   * Record pattern usage (for analytics)
   * Requires authentication
   */
  async recordPatternUsage(id: string): Promise<void> {
    const headers = await getAuthHeaders();

    // Only send if authenticated
    if (!headers['Authorization']) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/v1/patterns/library/${id}/use`, {
        method: 'POST',
        headers,
      });
      // Silently ignore errors - usage tracking is non-critical
    } catch {
      // Ignore - non-critical operation
    }
  },

  /**
   * Create a new pattern in the library
   * Requires authentication
   */
  async createPattern(input: CreatePatternInput): Promise<PatternLibraryItem> {
    const headers = await getAuthHeaders();

    if (!headers['Authorization']) {
      throw new Error('Authentication required to save patterns');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/patterns/library`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to save pattern');
    }

    const data = await response.json();
    return data.pattern;
  },
};
