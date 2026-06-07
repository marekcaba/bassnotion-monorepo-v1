import { Injectable } from '@nestjs/common';

import { CollectionsRepository } from './repositories/collections.repository.js';
import { CollectionTutorialsRepository } from './repositories/collection-tutorials.repository.js';
import { EntitlementService } from '../billing/services/entitlement.service.js';
import { PurchaseRepository } from '../billing/repositories/purchase.repository.js';
import { ProductRepository } from '../billing/repositories/product.repository.js';
import { ProductContentsRepository } from '../billing/repositories/product-contents.repository.js';
import { TutorialsService } from '../tutorials/tutorials.service.js';
import { CollectionView } from './types/collections.types.js';

/**
 * CollectionsService — builds the DB-driven sidebar folder list.
 *
 * The returned list is the union of:
 *   1. Real `collections` folders, access-resolved via EntitlementService.
 *      A folder the caller can't access is NOT dropped — it's returned with
 *      `isLocked: true` so the sidebar can render it as an upgrade teaser
 *      (preserving the old hardcoded-folder behavior where a paid folder
 *      showed locked). Its tutorialIds are withheld when locked.
 *   2. VIRTUAL pack-folders: for every product the user OWNS, a folder built
 *      from product_contents (content_type='tutorial'). These are computed, not
 *      stored — product_contents stays the single source of truth for owned
 *      content, so this never fights the auto-gating that flips a tutorial's
 *      access_tier when it's bundled into a pack.
 */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly collectionsRepository: CollectionsRepository,
    private readonly collectionTutorialsRepository: CollectionTutorialsRepository,
    private readonly entitlementService: EntitlementService,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly productRepository: ProductRepository,
    private readonly productContentsRepository: ProductContentsRepository,
    private readonly tutorialsService: TutorialsService,
  ) {}

  /**
   * The sidebar folder list for a caller (`userId` null for anonymous).
   * Folders are ordered: real collections by sort_order first, then virtual
   * pack-folders by the product's sort_order.
   */
  async getVisibleCollections(
    userId: string | null,
  ): Promise<CollectionView[]> {
    const dbFolders = await this.buildDbFolders(userId);
    const packFolders = await this.buildVirtualPackFolders(userId);
    return [...dbFolders, ...packFolders];
  }

  /** Real `collections` rows, access-resolved (locked teasers preserved). */
  private async buildDbFolders(
    userId: string | null,
  ): Promise<CollectionView[]> {
    const collections = await this.collectionsRepository.findAllActive();
    if (collections.length === 0) return [];

    // One batch read for every folder's assignments.
    const assignments =
      await this.collectionTutorialsRepository.findByCollectionIds(
        collections.map((c) => c.id),
      );
    const tutorialIdsByCollection = new Map<string, string[]>();
    for (const a of assignments) {
      const list = tutorialIdsByCollection.get(a.collectionId) ?? [];
      list.push(a.tutorialId);
      tutorialIdsByCollection.set(a.collectionId, list);
    }

    // Resolve which folders the caller can access in one batched pass. We reuse
    // the content entitlement resolver by treating each folder as a gateable
    // item (free → always; member/product → per the user's entitlements).
    const accessible = await this.entitlementService.filterAccessible(
      userId,
      collections.map((c) => ({
        accessTier: c.accessTier,
        // A folder isn't a product_contents item, so there's no contentRef —
        // a 'product'-tier folder would need a productId. None do today
        // (collections are free/member); a future paid folder can set one.
        productId: null,
        _collectionId: c.id,
      })),
    );
    const accessibleIds = new Set(accessible.map((a) => a._collectionId));

    // Within an UNLOCKED folder, still hide individual tutorials the caller
    // can't open — e.g. a pack-gated tutorial that the category backfill also
    // placed in the free Starter Kit folder. Listing it in a free folder where
    // it can't be opened is confusing; the gated tutorial still surfaces in the
    // owned pack's virtual folder for buyers. Resolve all such tutorials in ONE
    // access pass (the same authority the tutorials list uses), then partition
    // the allowed set back per folder.
    const idsToCheck = new Set<string>();
    for (const c of collections) {
      if (accessibleIds.has(c.id)) {
        for (const id of tutorialIdsByCollection.get(c.id) ?? [])
          idsToCheck.add(id);
      }
    }
    const allowedTutorialIds = new Set(
      await this.tutorialsService.filterAccessibleTutorialIds(
        [...idsToCheck],
        userId,
      ),
    );

    return collections.map((c) => {
      const isLocked = !accessibleIds.has(c.id);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        accessTier: c.accessTier,
        sortOrder: c.sortOrder,
        source: 'collection' as const,
        isLocked,
        // Withhold contents for a locked teaser (folder name + lock only);
        // otherwise list only the tutorials the caller can actually open.
        tutorialIds: isLocked
          ? []
          : (tutorialIdsByCollection.get(c.id) ?? []).filter((id) =>
              allowedTutorialIds.has(id),
            ),
      };
    });
  }

  /**
   * Virtual folders for packs. Each product that bundles tutorials becomes a
   * folder of those tutorial ids (ordered by product_contents.sort_order).
   *
   * Which products: a buyer gets the packs they OWN; an admin gets ALL packs
   * (admins bypass gating everywhere, so they can preview every pack's folder);
   * anonymous users get none.
   */
  private async buildVirtualPackFolders(
    userId: string | null,
  ): Promise<CollectionView[]> {
    if (!userId) return [];

    // Admins preview every pack; everyone else sees only the packs they own.
    const isAdmin = await this.entitlementService.isAdmin(userId);
    const products = isAdmin
      ? await this.productRepository.findAllActive()
      : await this.resolveOwnedProducts(userId);
    if (products.length === 0) return [];

    const folders: CollectionView[] = [];
    for (const product of products) {
      // Only packs/courses/accelerators that bundle tutorials become folders;
      // the membership product isn't a content folder.
      if (product.type === 'membership') continue;

      const contents = await this.productContentsRepository.findByProductId(
        product.id,
      );
      const tutorialIds = contents
        .filter((c) => c.contentType === 'tutorial')
        .map((c) => c.contentId);
      if (tutorialIds.length === 0) continue;

      folders.push({
        id: `product:${product.id}`,
        slug: product.slug,
        title: product.name,
        description: product.tagline,
        accessTier: 'product',
        // Sort packs after the DB folders, by the product's own order.
        sortOrder: 1000 + (product.sortOrder ?? 0),
        source: 'product',
        isLocked: false, // owned (or admin preview) → unlocked
        tutorialIds,
      });
    }
    return folders;
  }

  /** The products a non-admin user has purchased (completed orders). */
  private async resolveOwnedProducts(userId: string) {
    const ownedIds =
      await this.purchaseRepository.getPurchasedProductIds(userId);
    const products = await Promise.all(
      ownedIds.map((id) => this.productRepository.findById(id)),
    );
    return products.filter((p): p is NonNullable<typeof p> => p !== null);
  }
}
