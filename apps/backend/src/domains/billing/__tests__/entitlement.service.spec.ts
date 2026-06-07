import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  EntitlementService,
  GateableContent,
} from '../services/entitlement.service.js';
import type { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type { PurchaseRepository } from '../repositories/purchase.repository.js';
import type { ProductContentsRepository } from '../repositories/product-contents.repository.js';
import type { AcceleratorEnrollmentRepository } from '../repositories/accelerator-enrollment.repository.js';

const PACK_A = 'product-pack-a';
const PACK_B = 'product-pack-b';

interface BundleSpec {
  productId: string;
  unlockDay?: number;
}

/**
 * Build an EntitlementService with mocked repos describing a user's state.
 *   - hasSubscription: active subscription / founder
 *   - ownedProducts:   product IDs the user has purchased
 *   - bundles:         contentId → which products bundle it (for the join-table path)
 *   - enrollments:     productId → started_at (for accelerator drip)
 *   - now:             fixed clock for drip tests
 */
function makeService(opts: {
  hasSubscription?: boolean;
  ownedProducts?: string[];
  bundles?: Record<string, BundleSpec[]>;
  enrollments?: Record<string, Date>;
  now?: number;
}) {
  const hasActiveSubscription = vi.fn(
    async () => opts.hasSubscription ?? false,
  );
  const owned = opts.ownedProducts ?? [];
  const hasPurchasedProduct = vi.fn(async (_userId: string, productId: string) =>
    owned.includes(productId),
  );
  const getPurchasedProductIds = vi.fn(async () => owned);

  const findByContent = vi.fn(
    async (_type: string, contentId: string) =>
      (opts.bundles?.[contentId] ?? []).map((b) => ({
        id: `pc-${b.productId}`,
        productId: b.productId,
        contentType: 'groove',
        contentId,
        unlockDay: b.unlockDay ?? 0,
        sortOrder: 0,
        createdAt: new Date(0),
      })),
  );

  const findByUserAndProduct = vi.fn(
    async (_userId: string, productId: string) => {
      const startedAt = opts.enrollments?.[productId];
      return startedAt
        ? { id: 'e1', userId: 'u', productId, startedAt }
        : null;
    },
  );

  const service = new (class extends EntitlementService {
    protected now() {
      return opts.now ?? Date.now();
    }
  })(
    { hasActiveSubscription } as unknown as SubscriptionRepository,
    {
      hasPurchasedProduct,
      getPurchasedProductIds,
    } as unknown as PurchaseRepository,
    { findByContent } as unknown as ProductContentsRepository,
    { findByUserAndProduct } as unknown as AcceleratorEnrollmentRepository,
  );
  return {
    service,
    hasActiveSubscription,
    hasPurchasedProduct,
    findByContent,
    findByUserAndProduct,
  };
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

// ---------------------------------------------------------------------------
// product_contents bundle path (a content item can be in many packs) + drip
// ---------------------------------------------------------------------------
const GROOVE_REF = { type: 'groove' as const, id: 'groove-1' };
const bundledContent: GateableContent = {
  accessTier: 'product',
  contentRef: GROOVE_REF,
};
const DAY = 1000 * 60 * 60 * 24;

describe('EntitlementService — product_contents bundle resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies when the content is in no bundle', async () => {
    const { service } = makeService({ ownedProducts: [PACK_A], bundles: {} });
    expect(await service.canAccessContent('u', bundledContent)).toBe(false);
  });

  it('grants when the user owns a product that bundles the content', async () => {
    const { service } = makeService({
      ownedProducts: [PACK_A],
      bundles: { 'groove-1': [{ productId: PACK_A }] },
    });
    expect(await service.canAccessContent('u', bundledContent)).toBe(true);
  });

  it('grants if ANY owned product bundles it (content in two packs)', async () => {
    const { service } = makeService({
      ownedProducts: [PACK_B], // owns B, not A
      bundles: {
        'groove-1': [{ productId: PACK_A }, { productId: PACK_B }],
      },
    });
    expect(await service.canAccessContent('u', bundledContent)).toBe(true);
  });

  it('denies when the user owns none of the bundling products', async () => {
    const { service } = makeService({
      ownedProducts: [], // owns nothing
      bundles: { 'groove-1': [{ productId: PACK_A }] },
    });
    expect(await service.canAccessContent('u', bundledContent)).toBe(false);
  });

  it('anonymous user denied bundled product content', async () => {
    const { service } = makeService({
      bundles: { 'groove-1': [{ productId: PACK_A }] },
    });
    expect(await service.canAccessContent(null, bundledContent)).toBe(false);
  });
});

describe('EntitlementService — accelerator drip (unlock_day)', () => {
  beforeEach(() => vi.clearAllMocks());

  const ACCEL = 'accel-product';
  // content unlocks on day 7 of the accelerator
  const day7Content: GateableContent = {
    accessTier: 'product',
    contentRef: { type: 'groove', id: 'accel-groove' },
  };

  it('locked before the unlock day even though the product is owned', async () => {
    const enrolledAt = new Date(0);
    const { service } = makeService({
      ownedProducts: [ACCEL],
      bundles: { 'accel-groove': [{ productId: ACCEL, unlockDay: 7 }] },
      enrollments: { [ACCEL]: enrolledAt },
      now: enrolledAt.getTime() + 3 * DAY, // only day 3
    });
    expect(await service.canAccessContent('u', day7Content)).toBe(false);
  });

  it('unlocked once the unlock day has elapsed', async () => {
    const enrolledAt = new Date(0);
    const { service } = makeService({
      ownedProducts: [ACCEL],
      bundles: { 'accel-groove': [{ productId: ACCEL, unlockDay: 7 }] },
      enrollments: { [ACCEL]: enrolledAt },
      now: enrolledAt.getTime() + 8 * DAY, // day 8 — past day 7
    });
    expect(await service.canAccessContent('u', day7Content)).toBe(true);
  });

  it('owns the accelerator but has no enrollment row → locked', async () => {
    const { service } = makeService({
      ownedProducts: [ACCEL],
      bundles: { 'accel-groove': [{ productId: ACCEL, unlockDay: 7 }] },
      enrollments: {}, // no clock started
      now: 999 * DAY,
    });
    expect(await service.canAccessContent('u', day7Content)).toBe(false);
  });

  it('day-0 accelerator content is immediately available on purchase', async () => {
    const { service } = makeService({
      ownedProducts: [ACCEL],
      bundles: { 'accel-groove': [{ productId: ACCEL, unlockDay: 0 }] },
      enrollments: { [ACCEL]: new Date(0) },
      now: 0,
    });
    expect(await service.canAccessContent('u', day7Content)).toBe(true);
  });
});
