import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { GroovesController } from '../grooves.controller.js';
import type { GroovesService } from '../grooves.service.js';
import type { EntitlementService } from '../../billing/services/entitlement.service.js';
import type { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import type { FeatureKey } from '@bassnotion/contracts';

const GROOVE_ID = 'groove-1';
const VARIANT_ID = 'warm';
const SIGNED = { url: 'https://x/object/sign/premium-basslines/p?token=t', expiresAt: '2026-01-01T00:00:00Z' };

/**
 * Build the controller with a configurable gate (the groove's tier) and the
 * user's granted features / content-access verdict.
 */
function makeController(opts: {
  accessTier?: 'free' | 'member' | 'product';
  feature?: string;
  canAccessContent?: boolean;
  grantedFeatures?: FeatureKey[];
  variantMissing?: boolean;
}) {
  const resolveBasslineGate = vi.fn(async () => {
    if (opts.variantMissing) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('variant not found');
    }
    return {
      accessTier: opts.accessTier ?? 'free',
      productId: opts.accessTier === 'product' ? 'pack-x' : null,
      feature: opts.feature ?? 'linesAndFills',
      bucket: 'premium-basslines',
      objectPath: 'grooves/g/warm.ogg',
    };
  });

  const canAccessContent = vi.fn(async () => opts.canAccessContent ?? true);
  const getGrantedFeatures = vi.fn(async () => opts.grantedFeatures ?? []);
  const createSignedReadUrl = vi.fn(async () => SIGNED);

  const controller = new GroovesController(
    { resolveBasslineGate } as unknown as GroovesService,
    { canAccessContent, getGrantedFeatures } as unknown as EntitlementService,
    { createSignedReadUrl } as unknown as SupabaseService,
  );
  return { controller, canAccessContent, getGrantedFeatures, createSignedReadUrl };
}

const USER = { id: 'user-1' } as never;

describe('GroovesController.getBasslineUrlByPath — path signer (inline blocks)', () => {
  beforeEach(() => vi.clearAllMocks());

  const VALID_PATH = 'grooves/test-groove-2/var-abc.ogg';
  const VALID_REF =
    'https://x.supabase.co/storage/v1/object/sign/premium-basslines/grooves/test-groove-2/var-abc.ogg';

  function ctrl(grantedFeatures: FeatureKey[]) {
    const getGrantedFeatures = vi.fn(async () => grantedFeatures);
    const createSignedReadUrl = vi.fn(async () => SIGNED);
    const controller = new GroovesController(
      {} as unknown as GroovesService,
      { getGrantedFeatures } as unknown as EntitlementService,
      { createSignedReadUrl } as unknown as SupabaseService,
    );
    return { controller, createSignedReadUrl };
  }

  it('signs a valid premium-basslines path for an entitled user', async () => {
    const { controller, createSignedReadUrl } = ctrl(['linesAndFills']);
    const res = await controller.getBasslineUrlByPath(VALID_PATH, USER);
    expect(res).toEqual(SIGNED);
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'premium-basslines',
      VALID_PATH,
      600,
    );
  });

  it('accepts a full storage REF url (strips host + bucket prefix)', async () => {
    const { controller, createSignedReadUrl } = ctrl(['linesAndFills']);
    await controller.getBasslineUrlByPath(VALID_REF, USER);
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'premium-basslines',
      VALID_PATH,
      600,
    );
  });

  it('400s on a missing path', async () => {
    const { controller } = ctrl(['linesAndFills']);
    await expect(
      controller.getBasslineUrlByPath(undefined, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('403s without the linesAndFills feature', async () => {
    const { controller, createSignedReadUrl } = ctrl([]);
    await expect(
      controller.getBasslineUrlByPath(VALID_PATH, USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('REJECTS a path-traversal attempt (cannot sign arbitrary objects)', async () => {
    const { controller, createSignedReadUrl } = ctrl(['linesAndFills']);
    await expect(
      controller.getBasslineUrlByPath('grooves/../../secrets/key.ogg', USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('REJECTS a different bucket', async () => {
    const { controller, createSignedReadUrl } = ctrl(['linesAndFills']);
    await expect(
      controller.getBasslineUrlByPath(
        'https://x/storage/v1/object/public/audio-samples/grooves/g/bass.ogg',
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('REJECTS a non-ogg / malformed path', async () => {
    const { controller } = ctrl(['linesAndFills']);
    await expect(
      controller.getBasslineUrlByPath('grooves/g/evil.exe', USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GroovesController.getBasslineUrl — the AND-gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400 when variantId is missing', async () => {
    const { controller } = makeController({});
    await expect(
      controller.getBasslineUrl(GROOVE_ID, undefined, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signs for an entitled user on a free groove (feature granted)', async () => {
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'free',
      canAccessContent: true,
      grantedFeatures: ['linesAndFills'],
    });
    const res = await controller.getBasslineUrl(GROOVE_ID, VARIANT_ID, USER);
    expect(res).toEqual(SIGNED);
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'premium-basslines',
      'grooves/g/warm.ogg',
      600,
    );
  });

  it('403 when the user lacks the linesAndFills FEATURE (free groove)', async () => {
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'free',
      canAccessContent: true,
      grantedFeatures: [], // no linesAndFills
    });
    await expect(
      controller.getBasslineUrl(GROOVE_ID, VARIANT_ID, USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('403 when the user has the feature but CANNOT open the (gated) groove — the closed hole', async () => {
    const { controller, getGrantedFeatures, createSignedReadUrl } =
      makeController({
        accessTier: 'product', // groove is behind a different pack
        canAccessContent: false, // user does NOT own that pack
        grantedFeatures: ['linesAndFills'], // but DOES hold the feature
      });
    await expect(
      controller.getBasslineUrl(GROOVE_ID, VARIANT_ID, USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Content check fails first → feature check + signing never run.
    expect(getGrantedFeatures).not.toHaveBeenCalled();
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('signs when the user owns BOTH the gated groove AND the feature', async () => {
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'product',
      canAccessContent: true, // owns the pack
      grantedFeatures: ['linesAndFills'],
    });
    const res = await controller.getBasslineUrl(GROOVE_ID, VARIANT_ID, USER);
    expect(res).toEqual(SIGNED);
    expect(createSignedReadUrl).toHaveBeenCalledOnce();
  });

  it('anonymous user (no user) is gated like a free user → 403 without the feature', async () => {
    const { controller } = makeController({
      accessTier: 'free',
      canAccessContent: true,
      grantedFeatures: [],
    });
    await expect(
      controller.getBasslineUrl(GROOVE_ID, VARIANT_ID, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('honours a custom variant feature key (not just linesAndFills)', async () => {
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'free',
      feature: 'deconstruction', // variant gated behind a different feature
      canAccessContent: true,
      grantedFeatures: ['linesAndFills'], // has linesAndFills but NOT deconstruction
    });
    await expect(
      controller.getBasslineUrl(GROOVE_ID, VARIANT_ID, USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });
});
