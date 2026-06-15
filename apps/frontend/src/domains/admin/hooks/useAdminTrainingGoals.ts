'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
} from '@bassnotion/contracts';

import { adminTrainingGoalsApi } from '../api/training-goals.api';

const goalKeys = {
  all: ['admin-training-goals'] as const,
  list: () => [...goalKeys.all, 'list'] as const,
  detail: (id: string) => [...goalKeys.all, 'detail', id] as const,
};

export function useAdminTrainingGoals() {
  return useQuery({
    queryKey: goalKeys.list(),
    queryFn: () => adminTrainingGoalsApi.list(),
    staleTime: 60_000,
  });
}

export function useCreateTrainingGoal() {
  const qc = useQueryClient();
  return useMutation<Goal, Error, CreateGoalInput>({
    mutationFn: (input) => adminTrainingGoalsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

export function useUpdateTrainingGoal() {
  const qc = useQueryClient();
  return useMutation<Goal, Error, { id: string; patch: UpdateGoalInput }>({
    mutationFn: ({ id, patch }) => adminTrainingGoalsApi.update(id, patch),
    onSuccess: (goal) => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
      qc.invalidateQueries({ queryKey: goalKeys.detail(goal.id) });
    },
  });
}

export function useDeleteTrainingGoal() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => adminTrainingGoalsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}
