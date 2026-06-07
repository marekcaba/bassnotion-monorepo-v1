import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AdminCollectionsController } from '../admin-collections.controller.js';
import type { CollectionsRepository } from '../repositories/collections.repository.js';
import type { CollectionTutorialsRepository } from '../repositories/collection-tutorials.repository.js';

describe('AdminCollectionsController', () => {
  let controller: AdminCollectionsController;
  let collectionsRepo: any;
  let collectionTutorialsRepo: any;

  beforeEach(() => {
    collectionsRepo = {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    collectionTutorialsRepo = {
      findByCollectionId: vi.fn().mockResolvedValue([]),
      add: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    controller = new AdminCollectionsController(
      collectionsRepo as unknown as CollectionsRepository,
      collectionTutorialsRepo as unknown as CollectionTutorialsRepository,
    );
  });

  describe('create', () => {
    it('rejects a missing slug', async () => {
      await expect(
        controller.create({ slug: '', title: 'X' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing title', async () => {
      await expect(
        controller.create({ slug: 'x', title: '  ' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid accessTier', async () => {
      await expect(
        controller.create({
          slug: 'x',
          title: 'X',
          accessTier: 'bogus' as any,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a valid collection', async () => {
      collectionsRepo.create.mockResolvedValue({ id: 'c1', slug: 'x' });
      const res = await controller.create({
        slug: 'x',
        title: 'X',
        accessTier: 'member',
      });
      expect(res.collection.id).toBe('c1');
      expect(collectionsRepo.create).toHaveBeenCalledOnce();
    });
  });

  describe('update', () => {
    it('404s an unknown collection', async () => {
      collectionsRepo.findById.mockResolvedValue(null);
      await expect(
        controller.update('missing', { title: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an invalid accessTier patch', async () => {
      await expect(
        controller.update('c1', { accessTier: 'nope' as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assignTutorial', () => {
    it('requires a tutorialId', async () => {
      await expect(
        controller.assignTutorial('c1', {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when the collection does not exist', async () => {
      collectionsRepo.findById.mockResolvedValue(null);
      await expect(
        controller.assignTutorial('missing', { tutorialId: 't1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assigns a tutorial WITHOUT mutating tutorial gating (organizational only)', async () => {
      collectionsRepo.findById.mockResolvedValue({ id: 'c1' });
      collectionTutorialsRepo.add.mockResolvedValue({ id: 'a1' });

      const res = await controller.assignTutorial('c1', {
        tutorialId: 't1',
        sortOrder: 3,
      });

      expect(res.assignment.id).toBe('a1');
      expect(collectionTutorialsRepo.add).toHaveBeenCalledWith({
        collectionId: 'c1',
        tutorialId: 't1',
        sortOrder: 3,
      });
      // The controller only has the two folder repos — there is no path to
      // touch tutorials.access_tier/product_id. (Contrast admin-products, which
      // gates on bundle.) This is the design guarantee that prevents two
      // authorities from fighting over gating.
    });
  });

  describe('remove / unassign', () => {
    it('deletes a collection (cascade removes assignments)', async () => {
      collectionsRepo.findById.mockResolvedValue({ id: 'c1' });
      const res = await controller.remove('c1');
      expect(res.removed).toBe(true);
      expect(collectionsRepo.delete).toHaveBeenCalledWith('c1');
    });

    it('unassigns a tutorial by assignment id', async () => {
      const res = await controller.unassignTutorial('a1');
      expect(res.removed).toBe(true);
      expect(collectionTutorialsRepo.remove).toHaveBeenCalledWith('a1');
    });
  });
});
