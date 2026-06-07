import { Injectable, Logger } from '@nestjs/common';

import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { PurchaseRepository } from '../repositories/purchase.repository.js';
import { ProductContentsRepository } from '../repositories/product-contents.repository.js';
import { AcceleratorEnrollmentRepository } from '../repositories/accelerator-enrollment.repository.js';
import { ProductRepository } from '../repositories/product.repository.js';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import {
  ContentAccessTier,
  ProductContentType,
} from '../types/billing.types.js';

/**
 * The access requirement of a single piece of gateable content.
 *
 * For a `product`-tier item there are two ways to express which product unlocks
 * it, in priority order:
 *   1. `contentRef` ({type,id}) — resolve via the `product_contents` bundle:
 *      the user may access it if they own ANY product that bundles this item
 *      (and, for accelerator items, the day has unlocked). PREFERRED — supports
 *      a content item belonging to many packs.
 *   2. `productId` — the legacy single-FK path (the video signer still uses it).
 * One of the two must be present for a `product`-tier item.
 */
export interface GateableContent {
  accessTier: ContentAccessTier;
  productId?: string | null;
  contentRef?: { type: ProductContentType; id: string };
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
    private readonly productContentsRepository: ProductContentsRepository,
    private readonly acceleratorEnrollmentRepository: AcceleratorEnrollmentRepository,
    private readonly productRepository: ProductRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Admins see EVERYTHING — bypass all gating (so they can author/preview
   * gated tutorials, packs, etc.). Checks profiles.role like AdminGuard.
   * Public so other domains (e.g. collections) can mirror the admin-preview
   * behavior consistently rather than re-querying profiles themselves.
   */
  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    return !error && data?.role === 'admin';
  }

  /**
   * Member-level access: an active subscription/founder OR ownership of an
   * accelerator product (the accelerator confers membership-tier access in
   * addition to its own bundled content — per the product access matrix).
   * Groove-pack ownership does NOT confer membership.
   */
  private async hasMemberAccess(userId: string): Promise<boolean> {
    if (await this.subscriptionRepository.hasActiveSubscription(userId)) {
      return true;
    }
    const ownedIds =
      await this.purchaseRepository.getPurchasedProductIds(userId);
    if (ownedIds.length === 0) return false;
    for (const id of ownedIds) {
      const product = await this.productRepository.findById(id);
      if (product?.type === 'accelerator') return true;
    }
    return false;
  }

  /**
   * Resolve access for one content item. `userId` is null for anonymous callers.
   * Fails CLOSED: an unknown tier or a malformed product item denies access.
   */
  async canAccessContent(
    userId: string | null,
    content: GateableContent,
  ): Promise<boolean> {
    if (content.accessTier === 'free') return true;

    // Admins bypass all gating (author/preview any content).
    if (userId && (await this.isAdmin(userId))) return true;

    switch (content.accessTier) {
      case 'member':
        if (!userId) return false;
        return this.hasMemberAccess(userId);

      case 'product': {
        if (!userId) return false;

        // Preferred path: resolve via product_contents (item may be in many
        // products). Own ANY bundling product → access, with accelerator drip.
        if (content.contentRef) {
          return this.canAccessViaBundles(userId, content.contentRef);
        }

        // Legacy single-FK path (the video signer passes productId directly).
        if (content.productId) {
          return this.purchaseRepository.hasPurchasedProduct(
            userId,
            content.productId,
          );
        }

        // A 'product'-tier item with neither ref is a data error. Fail closed.
        this.logger.warn(
          'product-tier content has no contentRef or productId — denying access',
        );
        return false;
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
   * A content item is accessible if the user owns ANY product that bundles it
   * (via product_contents). For accelerator bundles, the item's unlock_day must
   * also have elapsed since the user's enrollment started_at.
   */
  private async canAccessViaBundles(
    userId: string,
    ref: { type: ProductContentType; id: string },
  ): Promise<boolean> {
    const bundles = await this.productContentsRepository.findByContent(
      ref.type,
      ref.id,
    );
    if (bundles.length === 0) return false;

    const ownedProductIds = new Set(
      await this.purchaseRepository.getPurchasedProductIds(userId),
    );

    for (const bundle of bundles) {
      if (!ownedProductIds.has(bundle.productId)) continue;
      // Owned. Flat packs (unlock_day 0) → immediate access.
      if (bundle.unlockDay <= 0) return true;
      // Accelerator drip: check the enrollment clock.
      if (
        await this.isDripUnlocked(userId, bundle.productId, bundle.unlockDay)
      ) {
        return true;
      }
    }
    return false;
  }

  /** Whether `unlockDay` days have elapsed since the user's enrollment. */
  private async isDripUnlocked(
    userId: string,
    productId: string,
    unlockDay: number,
  ): Promise<boolean> {
    const enrollment =
      await this.acceleratorEnrollmentRepository.findByUserAndProduct(
        userId,
        productId,
      );
    if (!enrollment) return false; // owns product but no drip clock → not unlocked
    const elapsedMs = this.now() - enrollment.startedAt.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    return elapsedDays >= unlockDay;
  }

  /** Wall clock, isolated for testability. */
  protected now(): number {
    return Date.now();
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

    // Admins see everything.
    if (await this.isAdmin(userId)) return items;

    // Member access (subscription OR accelerator ownership) resolved once.
    const memberAccess = needsMember
      ? await this.hasMemberAccess(userId)
      : false;
    const ownedProductIds = needsProduct
      ? new Set(await this.purchaseRepository.getPurchasedProductIds(userId))
      : new Set<string>();

    // product-tier items with a contentRef need a per-item bundle lookup; do
    // those individually (still reusing the single ownership read above). Items
    // with only a legacy productId stay on the in-memory fast path.
    const results = await Promise.all(
      items.map(async (item) => {
        switch (item.accessTier) {
          case 'free':
            return true;
          case 'member':
            return memberAccess;
          case 'product':
            if (item.contentRef) {
              return this.canAccessViaBundles(userId, item.contentRef);
            }
            return !!item.productId && ownedProductIds.has(item.productId);
          default:
            return false;
        }
      }),
    );

    return items.filter((_item, i) => results[i]);
  }
}
