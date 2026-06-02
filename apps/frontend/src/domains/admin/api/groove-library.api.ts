/**
 * Groove Library API Client — communication with the reusable groove library
 * backend (apps/backend/src/domains/grooves). Mirrors pattern-library.api.ts.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  GrooveLibraryItem,
  GrooveLibraryResponse,
  CreateGrooveInput,
  UpdateGrooveInput,
} from '@bassnotion/contracts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

async function authHeaders(): Promise<Record<string, string>> {
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

export const grooveLibraryApi = {
  /** List grooves (active by default; admin can include inactive). */
  async list(includeInactive = false): Promise<GrooveLibraryResponse> {
    const url = `${API_BASE_URL}/api/v1/grooves/library${
      includeInactive ? '?includeInactive=true' : ''
    }`;
    const res = await fetch(url, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to list grooves');
    return res.json();
  },

  /** Fetch one groove by id (public). */
  async get(id: string): Promise<GrooveLibraryItem> {
    const res = await fetch(`${API_BASE_URL}/api/v1/grooves/library/${id}`);
    if (!res.ok) throw new Error('Failed to fetch groove');
    const { groove } = (await res.json()) as { groove: GrooveLibraryItem };
    return groove;
  },

  /** Create a groove (admin). */
  async create(input: CreateGrooveInput): Promise<GrooveLibraryItem> {
    const res = await fetch(`${API_BASE_URL}/api/v1/grooves/library`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to create groove');
    }
    const { groove } = (await res.json()) as { groove: GrooveLibraryItem };
    return groove;
  },

  /** Update a groove (admin). */
  async update(
    id: string,
    input: UpdateGrooveInput,
  ): Promise<GrooveLibraryItem> {
    const res = await fetch(`${API_BASE_URL}/api/v1/grooves/library/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to update groove');
    }
    const { groove } = (await res.json()) as { groove: GrooveLibraryItem };
    return groove;
  },
};
