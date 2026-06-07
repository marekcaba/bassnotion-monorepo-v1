/**
 * Admin Collections API Client — create/edit DB-driven sidebar folders and
 * assign tutorials to them. Mirrors products.api.ts. All endpoints are
 * admin-gated on the backend (/api/v1/admin/collections).
 *
 * Assigning a tutorial here is PURELY organizational — unlike bundling content
 * into a pack, it does NOT change the tutorial's access tier.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ---- Types -----------------------------------------------------------------

export type CollectionAccessTier = 'free' | 'member' | 'product';

export interface AdminCollection {
  id: string;
  slug: string;
  title: string;
  description?: string;
  accessTier: CollectionAccessTier;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminCollectionTutorial {
  id: string;
  collectionId: string;
  tutorialId: string;
  sortOrder: number;
}

export interface CreateCollectionPayload {
  slug: string;
  title: string;
  description?: string;
  accessTier?: CollectionAccessTier;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCollectionPayload = Partial<CreateCollectionPayload>;

export interface AssignTutorialPayload {
  tutorialId: string;
  sortOrder?: number;
}

// ---- Auth ------------------------------------------------------------------

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

const BASE = `${API_BASE_URL}/api/v1/admin/collections`;

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || fallback);
}

// ---- API -------------------------------------------------------------------

export const adminCollectionsApi = {
  async list(): Promise<AdminCollection[]> {
    const res = await fetch(BASE, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to list collections');
    const { collections } = (await res.json()) as {
      collections: AdminCollection[];
    };
    return collections;
  },

  async get(id: string): Promise<{
    collection: AdminCollection;
    tutorials: AdminCollectionTutorial[];
  }> {
    const res = await fetch(`${BASE}/${id}`, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to fetch collection');
    return res.json();
  },

  async create(input: CreateCollectionPayload): Promise<AdminCollection> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to create collection');
    const { collection } = (await res.json()) as {
      collection: AdminCollection;
    };
    return collection;
  },

  async update(
    id: string,
    patch: UpdateCollectionPayload,
  ): Promise<AdminCollection> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) await parseError(res, 'Failed to update collection');
    const { collection } = (await res.json()) as {
      collection: AdminCollection;
    };
    return collection;
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!res.ok) await parseError(res, 'Failed to delete collection');
  },

  async assignTutorial(
    collectionId: string,
    input: AssignTutorialPayload,
  ): Promise<AdminCollectionTutorial> {
    const res = await fetch(`${BASE}/${collectionId}/tutorials`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to assign tutorial');
    const { assignment } = (await res.json()) as {
      assignment: AdminCollectionTutorial;
    };
    return assignment;
  },

  async unassignTutorial(assignmentId: string): Promise<void> {
    const res = await fetch(`${BASE}/tutorials/${assignmentId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!res.ok) await parseError(res, 'Failed to unassign tutorial');
  },
};
