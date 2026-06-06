import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  EntitlementService,
  GateableContent,
} from '../services/entitlement.service.js';
import type { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type { PurchaseRepository } from '../repositories/purchase.repository.js';

const PACK_A = 'product-pack-a';
const PACK_B = 'product-pack-b';

/**
 * Build an EntitlementService with mocked repos describing a user's state:
 *   - hasSubscription: active subscription / founder
 *   - ownedProducts:   product IDs the user has purchased
 */
function makeService(opts: {
  hasSubscription?: boolean;
  ownedProducts?: string[];
}) {
  const hasActiveSubscription = vi.fn(
    async () => opts.hasSubscription ?? false,
  );
  const owned = opts.ownedProducts ?? [];
  const hasPurchasedProduct = vi.fn(async (_userId: string, productId: string) =>
    owned.includes(productId),
  );
  const getPurchasedProductIds = vi.fn(async () => owned);

  const service = new EntitlementService(
    { hasActiveSubscription } as unknown as SubscriptionRepository,
    {
      hasPurchasedProduct,
      getPurchasedProductIds,
    } as unknown as PurchaseRepository,
  );
  return { service, hasActiveSubscription, hasPurchasedProduct };
}

// Content fixtures
const FREE: GateableContent = { accessTier: 'free' };
const MEMBER: GateableContent = { accessTier: 'member' };
const PACK: GateableContent = { accessTier: 'product', productId: PACK_A };

describe('EntitlementService.canAccessContent — the access matrix', () => {
  beforeEach(() => vi.clearAllMocks());

  // ---- free content: always accessible -------------------------------------
  it('anonymous user CAN access free content', async () => {
    const { service } = makeService({});
    expect(await service.canAccessContent(null, FREE)).toBe(true);
  });

  it('free content does not hit the subscription/purchase repos', async () => {
    const { service, hasActiveSubscription, hasPurchasedProduct } =
      makeService({});
    await service.canAccessContent('user-1', FREE);
    expect(hasActiveSubscription).not.toHaveBeenCalled();
    expect(hasPurchasedProduct).not.toHaveBeenCalled();
  });

  // ---- member content ------------------------------------------------------
  it('anonymous user CANNOT access member content', async () => {
    const { service } = makeService({ hasSubscription: true });
    expect(await service.canAccessContent(null, MEMBER)).toBe(false);
  });

  it('logged-in free user CANNOT access member content', async () => {
    const { service } = makeService({ hasSubscription: false });
    expect(await service.canAccessContent('free-user', MEMBER)).toBe(false);
  });

  it('member CAN access member content', async () => {
    const { service } = makeService({ hasSubscription: true });
    expect(await service.canAccessContent('member', MEMBER)).toBe(true);
  });

  // ---- product (pack) content — the product-scoped rule --------------------
  it('anonymous user CANNOT access product content', async () => {
    const { service } = makeService({});
    expect(await service.canAccessContent(null, PACK)).toBe(false);
  });

  it('member who did NOT buy the pack CANNOT access it (the key rule)', async () => {
    const { service } = makeService({
      hasSubscription: true,
      ownedProducts: [],
    });
    expect(await service.canAccessContent('member', PACK)).toBe(false);
  });

  it('pack buyer CAN access the pack', async () => {
    const { service } = makeService({ ownedProducts: [PACK_A] });
    expect(await service.canAccessContent('buyer', PACK)).toBe(true);
  });

  it('buyer of a DIFFERENT pack CANNOT access this pack', async () => {
    const { service } = makeService({ ownedProducts: [PACK_B] });
    expect(await service.canAccessContent('buyer', PACK)).toBe(false);
  });

  it('member who ALSO bought the pack CAN access it', async () => {
    const { service } = makeService({
      hasSubscription: true,
      ownedProducts: [PACK_A],
    });
    expect(await service.canAccessContent('member-buyer', PACK)).toBe(true);
  });

  // ---- fail-closed behavior ------------------------------------------------
  it('product-tier content with NO productId is denied (data error → closed)', async () => {
    const { service } = makeService({ hasSubscription: true });
    const malformed = { accessTier: 'product' } as GateableContent;
    expect(await service.canAccessContent('member', malformed)).toBe(false);
  });

  it('unknown access tier is denied (fail closed)', async () => {
    const { service } = makeService({ hasSubscription: true });
    const weird = { accessTier: 'galaxy-brain' } as unknown as GateableContent;
    expect(await service.canAccessContent('member', weird)).toBe(false);
  });
});

describe('EntitlementService.filterAccessible — batch gating', () => {
  beforeEach(() => vi.clearAllMocks());

  const items: GateableContent[] = [FREE, MEMBER, PACK];

  it('anonymous user gets only free items', async () => {
    const { service } = makeService({});
    const result = await service.filterAccessible(null, items);
    expect(result).toEqual([FREE]);
  });

  it('member gets free + member, not the un-owned pack', async () => {
    const { service } = makeService({ hasSubscription: true });
    const result = await service.filterAccessible('member', items);
    expect(result).toEqual([FREE, MEMBER]);
  });

  it('member who owns the pack gets all three', async () => {
    const { service } = makeService({
      hasSubscription: true,
      ownedProducts: [PACK_A],
    });
    const result = await service.filterAccessible('member-buyer', items);
    expect(result).toEqual([FREE, MEMBER, PACK]);
  });

  it('pack-only buyer (no subscription) gets free + pack, not member', async () => {
    const { service } = makeService({ ownedProducts: [PACK_A] });
    const result = await service.filterAccessible('buyer', items);
    expect(result).toEqual([FREE, PACK]);
  });

  it('resolves subscription + products ONCE for the whole list (no N+1)', async () => {
    const { service, hasActiveSubscription, hasPurchasedProduct } =
      makeService({ hasSubscription: true, ownedProducts: [PACK_A] });
    const many: GateableContent[] = [
      MEMBER,
      MEMBER,
      { accessTier: 'product', productId: PACK_A },
      { accessTier: 'product', productId: PACK_B },
    ];
    await service.filterAccessible('member-buyer', many);
    // Subscription checked once; per-item hasPurchasedProduct NOT used (batch path).
    expect(hasActiveSubscription).toHaveBeenCalledTimes(1);
    expect(hasPurchasedProduct).not.toHaveBeenCalled();
  });

  it('empty list returns empty without touching repos', async () => {
    const { service, hasActiveSubscription } = makeService({
      hasSubscription: true,
    });
    expect(await service.filterAccessible('member', [])).toEqual([]);
    expect(hasActiveSubscription).not.toHaveBeenCalled();
  });
});
