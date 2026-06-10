import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AdminProductsController } from '../admin-products.controller.js';
import type { ProductRepository } from '../repositories/product.repository.js';
import type { ProductContentsRepository } from '../repositories/product-contents.repository.js';
import type { ProductFeaturesRepository } from '../repositories/product-features.repository.js';
import type { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { FEATURE_KEYS } from '@bassnotion/contracts';

const PRODUCT_ID = 'prod-bass-college';

/**
 * Build the controller with the product repo configured to know (or not know)
 * the product, and a feature repo that records the last setForProduct call.
 */
function makeController(opts: { productExists?: boolean } = {}) {
  const findById = vi.fn(async (id: string) =>
    opts.productExists === false
      ? null
      : { id, name: 'Bass College', type: 'accelerator' },
  );
  const findByProductId = vi.fn(async () => ['linesAndFills']);
  const setForProduct = vi.fn(
    async (_id: string, keys: string[]) => [...new Set(keys)],
  );

  const controller = new AdminProductsController(
    { findById } as unknown as ProductRepository,
    {} as unknown as ProductContentsRepository,
    {
      findByProductId,
      setForProduct,
    } as unknown as ProductFeaturesRepository,
    {} as unknown as SupabaseService,
  );
  return { controller, findById, findByProductId, setForProduct };
}

describe('AdminProductsController — feature grants', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET :id/features', () => {
    it('returns the full feature catalog + the product current grants', async () => {
      const { controller } = makeController();
      const res = await controller.getFeatures(PRODUCT_ID);
      expect(res.available).toEqual([...FEATURE_KEYS]);
      expect(res.granted).toEqual(['linesAndFills']);
    });

    it('404s for an unknown product', async () => {
      const { controller } = makeController({ productExists: false });
      await expect(controller.getFeatures('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('PUT :id/features (replace set)', () => {
    it('stores the validated set and returns it', async () => {
      const { controller, setForProduct } = makeController();
      const res = await controller.setFeatures(PRODUCT_ID, {
        features: ['tempo', 'linesAndFills'],
      });
      expect(setForProduct).toHaveBeenCalledWith(PRODUCT_ID, [
        'tempo',
        'linesAndFills',
      ]);
      expect(res.granted).toEqual(['tempo', 'linesAndFills']);
    });

    it('accepts an empty array (revokes all grants)', async () => {
      const { controller, setForProduct } = makeController();
      const res = await controller.setFeatures(PRODUCT_ID, { features: [] });
      expect(setForProduct).toHaveBeenCalledWith(PRODUCT_ID, []);
      expect(res.granted).toEqual([]);
    });

    it('rejects an UNKNOWN feature key with 400 (never silently dropped)', async () => {
      const { controller, setForProduct } = makeController();
      await expect(
        controller.setFeatures(PRODUCT_ID, {
          features: ['tempo', 'teleportation'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(setForProduct).not.toHaveBeenCalled();
    });

    it('rejects a non-array body with 400', async () => {
      const { controller } = makeController();
      await expect(
        controller.setFeatures(PRODUCT_ID, { features: 'tempo' as never }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s for an unknown product (before any write)', async () => {
      const { controller, setForProduct } = makeController({
        productExists: false,
      });
      await expect(
        controller.setFeatures('nope', { features: ['tempo'] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(setForProduct).not.toHaveBeenCalled();
    });
  });
});
