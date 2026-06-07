import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CollectionsService } from '../collections.service.js';
import type { CollectionsRepository } from '../repositories/collections.repository.js';
import type { CollectionTutorialsRepository } from '../repositories/collection-tutorials.repository.js';
import type { EntitlementService } from '../../billing/services/entitlement.service.js';
import type { PurchaseRepository } from '../../billing/repositories/purchase.repository.js';
import type { ProductRepository } from '../../billing/repositories/product.repository.js';
import type { ProductContentsRepository } from '../../billing/repositories/product-contents.repository.js';
import type { TutorialsService } from '../../tutorials/tutorials.service.js';
import type { Collection } from '../types/collections.types.js';

// --- fixtures ---------------------------------------------------------------

const freeFolder: Collection = {
  id: 'col-free',
  slug: 'starter-kit',
  title: 'Starter Kit',
  description: 'Free',
  accessTier: 'free',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const memberFolder: Collection = {
  id: 'col-member',
  slug: 'revisiting-basics',
  title: 'Revisiting Basics',
  description: 'Members',
  accessTier: 'member',
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('CollectionsService', () => {
  let service: CollectionsService;
  let collectionsRepo: any;
  let collectionTutorialsRepo: any;
  let entitlementService: any;
  let purchaseRepo: any;
  let productRepo: any;
  let productContentsRepo: any;
  let tutorialsService: any;

  beforeEach(() => {
    collectionsRepo = {
      findAllActive: vi.fn().mockResolvedValue([freeFolder, memberFolder]),
    };
    collectionTutorialsRepo = {
      // free folder has 2 tutorials, member folder has 1
      findByCollectionIds: vi.fn().mockResolvedValue([
        { id: 'a1', collectionId: 'col-free', tutorialId: 'tut-1', sortOrder: 0 },
        { id: 'a2', collectionId: 'col-free', tutorialId: 'tut-2', sortOrder: 1 },
        {
          id: 'a3',
          collectionId: 'col-member',
          tutorialId: 'tut-3',
          sortOrder: 0,
        },
      ]),
    };
    // Default: pass-through (everything accessible), non-admin. Tests override.
    entitlementService = {
      filterAccessible: vi
        .fn()
        .mockImplementation((_uid: any, items: any[]) =>
          Promise.resolve(items),
        ),
      isAdmin: vi.fn().mockResolvedValue(false),
    };
    purchaseRepo = { getPurchasedProductIds: vi.fn().mockResolvedValue([]) };
    productRepo = { findById: vi.fn(), findAllActive: vi.fn().mockResolvedValue([]) };
    productContentsRepo = { findByProductId: vi.fn() };
    // Default: every tutorial is accessible (pass-through). Tests that need
    // gating override this to drop specific ids.
    tutorialsService = {
      filterAccessibleTutorialIds: vi
        .fn()
        .mockImplementation((ids: string[]) => Promise.resolve(ids)),
    };

    service = new CollectionsService(
      collectionsRepo as unknown as CollectionsRepository,
      collectionTutorialsRepo as unknown as CollectionTutorialsRepository,
      entitlementService as unknown as EntitlementService,
      purchaseRepo as unknown as PurchaseRepository,
      productRepo as unknown as ProductRepository,
      productContentsRepo as unknown as ProductContentsRepository,
      tutorialsService as unknown as TutorialsService,
    );
  });

  it('returns accessible folders with their ordered tutorialIds', async () => {
    const result = await service.getVisibleCollections('user-1');

    expect(result).toHaveLength(2);
    const free = result.find((c) => c.id === 'col-free')!;
    expect(free.source).toBe('collection');
    expect(free.isLocked).toBe(false);
    expect(free.tutorialIds).toEqual(['tut-1', 'tut-2']);

    const member = result.find((c) => c.id === 'col-member')!;
    expect(member.tutorialIds).toEqual(['tut-3']);
  });

  it('hides an individual gated tutorial from an unlocked (free) folder', async () => {
    // tut-2 is gated (e.g. bundled in a pack the caller doesn't own) — the
    // access filter drops it even though it's assigned to the free folder.
    tutorialsService.filterAccessibleTutorialIds.mockImplementation(
      (ids: string[]) => Promise.resolve(ids.filter((id) => id !== 'tut-2')),
    );

    const result = await service.getVisibleCollections('user-1');

    const free = result.find((c) => c.id === 'col-free')!;
    expect(free.isLocked).toBe(false);
    expect(free.tutorialIds).toEqual(['tut-1']); // tut-2 filtered out
  });

  it('returns a locked folder as a teaser WITHOUT its tutorialIds', async () => {
    // member folder is NOT accessible (anonymous-ish / no membership).
    entitlementService.filterAccessible.mockImplementation(
      (_uid: any, items: any[]) =>
        Promise.resolve(items.filter((i) => i.accessTier === 'free')),
    );

    const result = await service.getVisibleCollections('user-1');

    const member = result.find((c) => c.id === 'col-member')!;
    expect(member.isLocked).toBe(true);
    expect(member.tutorialIds).toEqual([]); // withheld
    // ...but the folder itself is still returned (the upsell teaser).
    expect(member.title).toBe('Revisiting Basics');

    const free = result.find((c) => c.id === 'col-free')!;
    expect(free.isLocked).toBe(false);
    expect(free.tutorialIds).toEqual(['tut-1', 'tut-2']);
  });

  it('anonymous callers get no virtual pack-folders', async () => {
    const result = await service.getVisibleCollections(null);
    expect(result.every((c) => c.source === 'collection')).toBe(true);
    expect(purchaseRepo.getPurchasedProductIds).not.toHaveBeenCalled();
  });

  it('emits a virtual folder for an owned pack that bundles tutorials', async () => {
    purchaseRepo.getPurchasedProductIds.mockResolvedValue(['prod-gospel']);
    productRepo.findById.mockResolvedValue({
      id: 'prod-gospel',
      slug: 'gospel-groove-pack',
      name: 'Gospel Groove Pack',
      tagline: 'Sunday service grooves',
      type: 'groove_pack',
      sortOrder: 2,
    });
    productContentsRepo.findByProductId.mockResolvedValue([
      { contentType: 'tutorial', contentId: 'tut-g1' },
      { contentType: 'video', contentId: 'vid-x' }, // ignored (not a tutorial)
      { contentType: 'tutorial', contentId: 'tut-g2' },
    ]);

    const result = await service.getVisibleCollections('user-1');

    const pack = result.find((c) => c.id === 'product:prod-gospel')!;
    expect(pack).toBeDefined();
    expect(pack.source).toBe('product');
    expect(pack.title).toBe('Gospel Groove Pack');
    expect(pack.accessTier).toBe('product');
    expect(pack.isLocked).toBe(false); // owned → unlocked
    expect(pack.tutorialIds).toEqual(['tut-g1', 'tut-g2']);
    // Ordered AFTER the db folders.
    expect(pack.sortOrder).toBeGreaterThanOrEqual(1000);
  });

  it('shows an admin ALL pack folders, even unowned ones', async () => {
    // Admin owns nothing, but should preview every pack.
    entitlementService.isAdmin.mockResolvedValue(true);
    purchaseRepo.getPurchasedProductIds.mockResolvedValue([]);
    productRepo.findAllActive.mockResolvedValue([
      {
        id: 'prod-gospel',
        slug: 'gospel-groove-pack',
        name: 'Gospel Groove Pack',
        tagline: 'Sunday grooves',
        type: 'groove_pack',
        sortOrder: 2,
      },
    ]);
    productContentsRepo.findByProductId.mockResolvedValue([
      { contentType: 'tutorial', contentId: 'tut-g1' },
    ]);

    const result = await service.getVisibleCollections('admin-user');

    const pack = result.find((c) => c.id === 'product:prod-gospel')!;
    expect(pack).toBeDefined();
    expect(pack.source).toBe('product');
    expect(pack.isLocked).toBe(false);
    expect(pack.tutorialIds).toEqual(['tut-g1']);
    // Resolved via findAllActive (admin path), NOT getPurchasedProductIds.
    expect(productRepo.findAllActive).toHaveBeenCalled();
  });

  it('does NOT emit a folder for the membership product', async () => {
    purchaseRepo.getPurchasedProductIds.mockResolvedValue(['prod-membership']);
    productRepo.findById.mockResolvedValue({
      id: 'prod-membership',
      slug: 'monthly-membership',
      name: 'Membership',
      type: 'membership',
      sortOrder: 0,
    });

    const result = await service.getVisibleCollections('user-1');
    expect(result.some((c) => c.source === 'product')).toBe(false);
    // findByProductId never called for a membership product.
    expect(productContentsRepo.findByProductId).not.toHaveBeenCalled();
  });

  it('skips an owned pack that bundles no tutorials', async () => {
    purchaseRepo.getPurchasedProductIds.mockResolvedValue(['prod-empty']);
    productRepo.findById.mockResolvedValue({
      id: 'prod-empty',
      slug: 'empty-pack',
      name: 'Empty',
      type: 'groove_pack',
      sortOrder: 0,
    });
    productContentsRepo.findByProductId.mockResolvedValue([
      { contentType: 'groove', contentId: 'grv-1' }, // no tutorials
    ]);

    const result = await service.getVisibleCollections('user-1');
    expect(result.some((c) => c.source === 'product')).toBe(false);
  });

  it('returns empty when there are no collections and nothing owned', async () => {
    collectionsRepo.findAllActive.mockResolvedValue([]);
    const result = await service.getVisibleCollections('user-1');
    expect(result).toEqual([]);
  });
});
