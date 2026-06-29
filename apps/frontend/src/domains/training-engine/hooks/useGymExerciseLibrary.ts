'use client';

/**
 * useGymExerciseLibrary — the authored exercise LIBRARY for a gym tool (the scales/grooves
 * a student picks from). Read-only fetch of every saved exercise for an equipment type;
 * the tool selects key/position/tempo at runtime from each exercise's stored variants.
 *
 * Shared content (same for everyone), so the query key is NOT user-scoped — but the GET is
 * AuthGuard-protected on the backend, so we gate `enabled` on auth to avoid a 401 before
 * login. The list is small + changes rarely, so it's cached aggressively.
 */

import { useQuery } from '@tanstack/react-query';
import type { GymExercise } from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';
import { fetchGymExercises } from '../api/training-engine.api';
import { gymKeys } from '../api/gymQueryKeys';

export function useGymExerciseLibrary(
  equipment: string,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const { isAuthenticated } = useAuth();

  return useQuery<GymExercise[]>({
    queryKey: gymKeys.exerciseLibrary(equipment),
    queryFn: () => fetchGymExercises({ equipment }),
    enabled: enabled && isAuthenticated,
    // Authored content — rarely changes within a session.
    staleTime: 5 * 60 * 1000,
  });
}
