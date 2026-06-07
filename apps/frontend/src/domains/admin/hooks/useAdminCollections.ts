'use client';

/**
 * Admin collection hooks (TanStack Query) — manage DB-driven sidebar folders
 * and their tutorial assignments. Mirrors useAdminProducts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  adminCollectionsApi,
  AdminCollection,
  CreateCollectionPayload,
  UpdateCollectionPayload,
  AssignTutorialPayload,
} from '@/domains/admin/api/collections.api';

const collectionKeys = {
  all: ['admin-collections'] as const,
  list: () => [...collectionKeys.all, 'list'] as const,
  detail: (id: string) => [...collectionKeys.all, 'detail', id] as const,
};

export function useAdminCollections() {
  return useQuery({
    queryKey: collectionKeys.list(),
    queryFn: () => adminCollectionsApi.list(),
    staleTime: 1000 * 60,
  });
}

export function useAdminCollection(id: string | undefined) {
  return useQuery({
    queryKey: collectionKeys.detail(id ?? ''),
    queryFn: () => adminCollectionsApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionPayload) =>
      adminCollectionsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateCollectionPayload;
    }) => adminCollectionsApi.update(id, patch),
    onSuccess: (collection: AdminCollection) => {
      qc.invalidateQueries({ queryKey: collectionKeys.all });
      qc.invalidateQueries({ queryKey: collectionKeys.detail(collection.id) });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCollectionsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useAssignTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      input,
    }: {
      collectionId: string;
      input: AssignTutorialPayload;
    }) => adminCollectionsApi.assignTutorial(collectionId, input),
    onSuccess: (_assignment, { collectionId }) =>
      qc.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) }),
  });
}

export function useUnassignTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
    }: {
      assignmentId: string;
      collectionId: string;
    }) => adminCollectionsApi.unassignTutorial(assignmentId),
    onSuccess: (_void, { collectionId }) =>
      qc.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) }),
  });
}
