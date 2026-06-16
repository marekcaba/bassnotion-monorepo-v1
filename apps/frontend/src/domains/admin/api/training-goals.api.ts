/**
 * Admin Training Goals API Client — create/edit/delete the goals the Bass Gym
 * engine plans from (Phase 5a). Mirrors products.api.ts. All endpoints are
 * admin-gated on the backend.
 */

import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
} from '@bassnotion/contracts';
// Reuse the app's SINGLE Supabase client (the shared singleton). Calling
// createClient() here would spin up a second GoTrueClient on the same
// storage key → the "Multiple GoTrueClient instances" warning + the
// two-clients-fighting auth bugs we've hit before. Mirrors training-engine.api.
import { supabase } from '@/infrastructure/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
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

const BASE = `${API_BASE_URL}/api/v1/training-engine/admin/goals`;

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || fallback);
}

export const adminTrainingGoalsApi = {
  async list(): Promise<Goal[]> {
    const res = await fetch(BASE, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to list training goals');
    const { goals } = (await res.json()) as { goals: Goal[] };
    return goals;
  },

  async get(id: string): Promise<Goal> {
    const res = await fetch(`${BASE}/${id}`, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to fetch training goal');
    const { goal } = (await res.json()) as { goal: Goal };
    return goal;
  },

  async create(input: CreateGoalInput): Promise<Goal> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to create training goal');
    const { goal } = (await res.json()) as { goal: Goal };
    return goal;
  },

  async update(id: string, patch: UpdateGoalInput): Promise<Goal> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) await parseError(res, 'Failed to update training goal');
    const { goal } = (await res.json()) as { goal: Goal };
    return goal;
  },

  async delete(id: string): Promise<void> {
    // Strip Content-Type so Fastify's JSON parser doesn't 400 on the empty
    // DELETE body (same gotcha as products.api.ts).
    const headers = await authHeaders();
    delete headers['Content-Type'];
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers });
    if (!res.ok) await parseError(res, 'Failed to delete training goal');
  },
};
