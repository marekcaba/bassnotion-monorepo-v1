'use client';

/**
 * Groove library hooks (TanStack Query) — read/create/update reusable grooves.
 *
 * - useGrooveLibrary(): list (for the admin picker + library page)
 * - useGroove(id): resolve a single groove (the renderer uses this to turn a
 *   block's grooveId into stems + defaults)
 * - useCreateGroove / useUpdateGroove: admin mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGrooveInput,
  UpdateGrooveInput,
} from '@bassnotion/contracts';

import { grooveLibraryApi } from '@/domains/admin/api/groove-library.api';

const grooveKeys = {
  all: ['grooves'] as const,
  list: (includeInactive: boolean) =>
    [...grooveKeys.all, 'list', includeInactive] as const,
  detail: (id: string) => [...grooveKeys.all, 'detail', id] as const,
};

/** List grooves for the admin picker / library page. */
export function useGrooveLibrary(includeInactive = false) {
  return useQuery({
    queryKey: grooveKeys.list(includeInactive),
    queryFn: () => grooveLibraryApi.list(includeInactive),
    staleTime: 1000 * 60 * 5,
  });
}

/** Resolve a single groove by id. `enabled` lets the renderer skip the fetch
 *  for inline (non-reference) blocks. */
export function useGroove(id: string | undefined) {
  return useQuery({
    queryKey: grooveKeys.detail(id ?? ''),
    queryFn: () => grooveLibraryApi.get(id as string),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateGroove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGrooveInput) => grooveLibraryApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: grooveKeys.all }),
  });
}

export function useUpdateGroove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGrooveInput }) =>
      grooveLibraryApi.update(id, input),
    onSuccess: (groove) => {
      qc.invalidateQueries({ queryKey: grooveKeys.all });
      qc.invalidateQueries({ queryKey: grooveKeys.detail(groove.id) });
    },
  });
}
