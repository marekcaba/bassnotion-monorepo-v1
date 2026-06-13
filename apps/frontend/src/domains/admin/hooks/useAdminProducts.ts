'use client';

/**
 * Admin product hooks (TanStack Query) — manage store products (Groove Packs,
 * Accelerator) and their bundled contents. Mirrors useGrooveLibrary.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  adminProductsApi,
  AdminProduct,
  CreateProductPayload,
  UpdateProductPayload,
  AddContentPayload,
} from '@/domains/admin/api/products.api';

const productKeys = {
  all: ['admin-products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

export function useAdminProducts() {
  return useQuery({
    queryKey: productKeys.list(),
    queryFn: () => adminProductsApi.list(),
    staleTime: 1000 * 60,
  });
}

export function useAdminProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => adminProductsApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductPayload) => adminProductsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProductPayload }) =>
      adminProductsApi.update(id, patch),
    onSuccess: (product: AdminProduct) => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      qc.invalidateQueries({ queryKey: productKeys.detail(product.id) });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminProductsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useAddProductContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      input,
    }: {
      productId: string;
      input: AddContentPayload;
    }) => adminProductsApi.addContent(productId, input),
    onSuccess: (_content, { productId }) =>
      qc.invalidateQueries({ queryKey: productKeys.detail(productId) }),
  });
}

export function useRemoveProductContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      contentRowId,
    }: {
      contentRowId: string;
      productId: string;
    }) => adminProductsApi.removeContent(contentRowId),
    onSuccess: (_void, { productId }) =>
      qc.invalidateQueries({ queryKey: productKeys.detail(productId) }),
  });
}
