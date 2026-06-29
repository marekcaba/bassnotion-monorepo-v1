/**
 * Admin Scale Blueprints API Client — author the gym Scales tool's box shapes +
 * practice rhythm. Mirrors training-goals.api.ts. Admin-gated on the backend.
 */

import type {
  ScaleBlueprintRecord,
  UpdateScaleBlueprintInput,
} from '@bassnotion/contracts';
// Reuse the app's SINGLE Supabase client — calling createClient() here spins up a
// second GoTrueClient on the same storage key (the "Multiple GoTrueClient" warning).
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

const BASE = `${API_BASE_URL}/api/v1/training-engine/admin/scales/blueprints`;

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || fallback);
}

export const adminScaleBlueprintsApi = {
  async list(): Promise<ScaleBlueprintRecord[]> {
    const res = await fetch(BASE, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to list scale blueprints');
    const { blueprints } = (await res.json()) as {
      blueprints: ScaleBlueprintRecord[];
    };
    return blueprints;
  },

  async update(
    scaleType: string,
    patch: UpdateScaleBlueprintInput,
  ): Promise<ScaleBlueprintRecord> {
    const res = await fetch(`${BASE}/${scaleType}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) await parseError(res, 'Failed to update scale blueprint');
    const { blueprint } = (await res.json()) as {
      blueprint: ScaleBlueprintRecord;
    };
    return blueprint;
  },
};
