/**
 * Admin Gym Exercises API Client — author exercises for gym equipment (scale paths,
 * grooves). Mirrors training-goals.api.ts. Admin-gated on the backend; draft-friendly.
 */

import type {
  GymExercise,
  CreateGymExerciseInput,
  UpdateGymExerciseInput,
} from '@bassnotion/contracts';
import { supabase } from '@/infrastructure/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const BASE = `${API_BASE_URL}/api/v1/training-engine/admin/gym-exercises`;

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

/** Auth headers WITHOUT Content-Type — for bodyless requests (DELETE). Fastify rejects
 *  an empty body when content-type is application/json. */
async function authHeadersNoBody(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || fallback);
}

export const adminGymExercisesApi = {
  async list(filters?: {
    equipment?: string;
    kind?: string;
  }): Promise<GymExercise[]> {
    const qs = new URLSearchParams();
    if (filters?.equipment) qs.set('equipment', filters.equipment);
    if (filters?.kind) qs.set('kind', filters.kind);
    const url = qs.toString() ? `${BASE}?${qs}` : BASE;
    const res = await fetch(url, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to list gym exercises');
    const { exercises } = (await res.json()) as { exercises: GymExercise[] };
    return exercises;
  },

  async get(id: string): Promise<GymExercise> {
    const res = await fetch(`${BASE}/${id}`, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to fetch gym exercise');
    const { exercise } = (await res.json()) as { exercise: GymExercise };
    return exercise;
  },

  async create(input: CreateGymExerciseInput): Promise<GymExercise> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to create gym exercise');
    const { exercise } = (await res.json()) as { exercise: GymExercise };
    return exercise;
  },

  async update(
    id: string,
    patch: UpdateGymExerciseInput,
  ): Promise<GymExercise> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) await parseError(res, 'Failed to update gym exercise');
    const { exercise } = (await res.json()) as { exercise: GymExercise };
    return exercise;
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'DELETE',
      headers: await authHeadersNoBody(), // no Content-Type — DELETE has no body
    });
    if (!res.ok) await parseError(res, 'Failed to delete gym exercise');
  },
};
