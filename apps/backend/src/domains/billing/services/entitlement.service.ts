import { Injectable, Logger } from '@nestjs/common';

import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { PurchaseRepository } from '../repositories/purchase.repository.js';
import { ContentAccessTier } from '../types/billing.types.js';

/**
 * The access requirement of a single piece of gateable content.
 * `productId` is required when `accessTier === 'product'`.
 */
export interface GateableContent {
  accessTier: ContentAccessTier;
  productId?: string | null;
}

/**
 * EntitlementService — the SINGLE server-side authority for "can this user
 * access this content item?". Every gate (video signer, storage signer, content
 * list endpoints) MUST funnel through here. The frontend `useEntitlement` hook
 * is a UX hint only (lock icons / upsell copy) and is never trusted.
 *
 * The four tiers:
 *   free    → anyone, including anonymous
 *   member  → active subscription / founder lifetime (synthetic active row)
 *   product → must OWN the linked product (a member who didn't buy the pack is
 *             NOT granted access — product-scoped, not membership-scoped)
 *
 * Accelerator time-drip layers onto the `product` branch later (owns product
 * AND day N unlocked); it is intentionally not implemented yet.
 */
@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly purchaseRepository: PurchaseRepository,
  ) {}

  /**
   * Resolve access for one content item. `userId` is null for anonymous callers.
   * Fails CLOSED: an unknown tier or a malformed product item denies access.
   */
  async canAccessContent(
    userId: string | null,
    content: GateableContent,
  ): Promise<boolean> {
    switch (content.accessTier) {
      case 'free':
        return true;

      case 'member':
        if (!userId) return false;
        return this.subscriptionRepository.hasActiveSubscription(userId);

      case 'product': {
        if (!userId) return false;
        if (!content.productId) {
          // A 'product'-tier item with no productId is a data error. The DB
          // CHECK constraint should prevent this; deny defensively if it slips.
          this.logger.warn(
            'product-tier content has no productId — denying access',
          );
          return false;
        }
        return this.purchaseRepository.hasPurchasedProduct(
          userId,
          content.productId,
        );
      }

      default:
        // Unknown tier → fail closed.
        this.logger.warn(
          `Unknown access tier "${String(content.accessTier)}" — denying access`,
        );
        return false;
    }
  }

  /**
   * Batch variant for list endpoints: filter a set of items to those the user
   * may access. Resolves the user's subscription + owned products ONCE, then
   * filters in memory — avoids N round-trips for a list of N items.
   */
  async filterAccessible<T extends GateableContent>(
    userId: string | null,
    items: T[],
  ): Promise<T[]> {
    if (items.length === 0) return [];

    // All-free fast path (and the only path that works for anonymous users).
    const needsMember = items.some((i) => i.accessTier === 'member');
    const needsProduct = items.some((i) => i.accessTier === 'product');

    if (!userId) {
      return items.filter((i) => i.accessTier === 'free');
    }

    const hasActiveSubscription = needsMember
      ? await this.subscriptionRepository.hasActiveSubscription(userId)
      : false;
    const ownedProductIds = needsProduct
      ? new Set(await this.purchaseRepository.getPurchasedProductIds(userId))
      : new Set<string>();

    return items.filter((item) => {
      switch (item.accessTier) {
        case 'free':
          return true;
        case 'member':
          return hasActiveSubscription;
        case 'product':
          return !!item.productId && ownedProductIds.has(item.productId);
        default:
          return false;
      }
    });
  }
}
