'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ScaleBlueprintRecord,
  UpdateScaleBlueprintInput,
} from '@bassnotion/contracts';

import { adminScaleBlueprintsApi } from '../api/scale-blueprints.api';

const blueprintKeys = {
  all: ['admin-scale-blueprints'] as const,
  list: () => [...blueprintKeys.all, 'list'] as const,
};

/** Every scale's authored blueprint (box shapes + rhythm). */
export function useAdminScaleBlueprints() {
  return useQuery({
    queryKey: blueprintKeys.list(),
    queryFn: () => adminScaleBlueprintsApi.list(),
    staleTime: 60_000,
    // Don't retry: until the scale_blueprints table exists (migration applies on merge),
    // this 500s, and the editor falls back to the in-code seed defaults — one failed
    // request is enough, no need to hammer it 3× and spam the console.
    retry: false,
  });
}

/** Replace one scale's positions and/or rhythm. */
export function useUpdateScaleBlueprint() {
  const qc = useQueryClient();
  return useMutation<
    ScaleBlueprintRecord,
    Error,
    { scaleType: string; patch: UpdateScaleBlueprintInput }
  >({
    mutationFn: ({ scaleType, patch }) =>
      adminScaleBlueprintsApi.update(scaleType, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: blueprintKeys.all }),
  });
}
