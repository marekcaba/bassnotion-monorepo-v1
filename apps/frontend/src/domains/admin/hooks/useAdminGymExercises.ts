'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GymExercise,
  CreateGymExerciseInput,
  UpdateGymExerciseInput,
} from '@bassnotion/contracts';

import { adminGymExercisesApi } from '../api/gym-exercises.api';

const keys = {
  all: ['admin-gym-exercises'] as const,
  list: (equipment?: string, kind?: string) =>
    [...keys.all, 'list', equipment ?? null, kind ?? null] as const,
};

/** Exercises for an equipment/kind (the saved list). */
export function useAdminGymExercises(filters?: {
  equipment?: string;
  kind?: string;
}) {
  return useQuery({
    queryKey: keys.list(filters?.equipment, filters?.kind),
    queryFn: () => adminGymExercisesApi.list(filters),
    staleTime: 30_000,
    retry: false, // until the table exists, this 500s; don't hammer it
  });
}

export function useCreateGymExercise() {
  const qc = useQueryClient();
  return useMutation<GymExercise, Error, CreateGymExerciseInput>({
    mutationFn: (input) => adminGymExercisesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateGymExercise() {
  const qc = useQueryClient();
  return useMutation<
    GymExercise,
    Error,
    { id: string; patch: UpdateGymExerciseInput }
  >({
    mutationFn: ({ id, patch }) => adminGymExercisesApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteGymExercise() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => adminGymExercisesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
