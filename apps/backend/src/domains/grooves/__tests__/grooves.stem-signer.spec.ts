import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { GroovesController } from '../grooves.controller.js';
import type { GroovesService } from '../grooves.service.js';
import type { EntitlementService } from '../../billing/services/entitlement.service.js';
import type { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

const GROOVE_ID = 'groove-1';
const SIGNED = {
  url: 'https://x/object/sign/groove-stems/p?token=t',
  expiresAt: '2026-01-01T00:00:00Z',
};
const USER = { id: 'user-1' } as never;

const PUBLIC = (key: string) =>
  `https://x.supabase.co/storage/v1/object/public/audio-samples/grooves/g/c/${key}.ogg`;
const PRIVATE = (key: string) =>
  `https://x.supabase.co/storage/v1/object/sign/groove-stems/grooves/g/c/${key}.ogg`;

/**
 * Build the controller with a configurable groove gate (tier + the bucket each
 * stem lives in) and the user's content-access verdict.
 */
function makeController(opts: {
  accessTier?: 'free' | 'member' | 'product';
  privateStems?: boolean; // stems live in groove-stems (vs public audio-samples)
  canAccessContent?: boolean;
}) {
  const tier = opts.accessTier ?? 'free';
  const mk = opts.privateStems ? PRIVATE : PUBLIC;
  const resolveStemGate = vi.fn(async () => ({
    accessTier: tier,
    productId: tier === 'product' ? 'pack-x' : null,
    stems: (['bass', 'drums', 'harmony'] as const).map((key) => ({
      key,
      url: mk(key),
      ref: {
        bucket: opts.privateStems ? 'groove-stems' : 'audio-samples',
        objectPath: `grooves/g/c/${key}.ogg`,
      },
    })),
  }));

  const canAccessContent = vi.fn(async () => opts.canAccessContent ?? true);
  const createSignedReadUrl = vi.fn(async () => SIGNED);

  const controller = new GroovesController(
    { resolveStemGate } as unknown as GroovesService,
    { canAccessContent } as unknown as EntitlementService,
    { createSignedReadUrl } as unknown as SupabaseService,
  );
  return { controller, canAccessContent, createSignedReadUrl };
}

describe('GroovesController.getStemUrls — groove-row stem signer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('FREE groove → returns public URLs untouched, no auth, no signing', async () => {
    const { controller, canAccessContent, createSignedReadUrl } = makeController(
      { accessTier: 'free' },
    );
    const res = await controller.getStemUrls(GROOVE_ID, undefined); // anon
    expect(res.stems.bass).toBe(PUBLIC('bass'));
    expect(res.expiresAt).toBeNull();
    expect(canAccessContent).not.toHaveBeenCalled();
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('MEMBER groove → signs each private stem for an entitled member', async () => {
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'member',
      privateStems: true,
      canAccessContent: true,
    });
    const res = await controller.getStemUrls(GROOVE_ID, USER);
    expect(res.stems.bass).toBe(SIGNED.url);
    expect(res.stems.drums).toBe(SIGNED.url);
    expect(res.stems.harmony).toBe(SIGNED.url);
    expect(res.expiresAt).not.toBeNull();
    expect(createSignedReadUrl).toHaveBeenCalledTimes(3);
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'groove-stems',
      'grooves/g/c/bass.ogg',
      3600,
    );
  });

  it('MEMBER groove → 403 for a non-member; nothing is signed', async () => {
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'member',
      privateStems: true,
      canAccessContent: false,
    });
    await expect(
      controller.getStemUrls(GROOVE_ID, USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('MEMBER groove → anonymous (no user) is denied → 403', async () => {
    const { controller } = makeController({
      accessTier: 'member',
      privateStems: true,
      canAccessContent: false, // canAccessContent(null, member) === false
    });
    await expect(
      controller.getStemUrls(GROOVE_ID, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('MEMBER groove with a still-PUBLIC stem (partial migration) → passes it through', async () => {
    // accessTier=member but stems still public (not yet moved to groove-stems):
    // the gate passes (member entitled) and the public stem is returned as-is.
    const { controller, createSignedReadUrl } = makeController({
      accessTier: 'member',
      privateStems: false, // public urls
      canAccessContent: true,
    });
    const res = await controller.getStemUrls(GROOVE_ID, USER);
    expect(res.stems.bass).toBe(PUBLIC('bass'));
    expect(createSignedReadUrl).not.toHaveBeenCalled(); // already public → no sign
  });
});

describe('GroovesController.getStemUrlByPath — inline path stem signer', () => {
  beforeEach(() => vi.clearAllMocks());

  const VALID_PATH = 'grooves/test-groove-2/c/bass.ogg';
  const VALID_REF =
    'https://x.supabase.co/storage/v1/object/sign/groove-stems/grooves/test-groove-2/c/bass.ogg';

  function ctrl(canAccess: boolean) {
    const canAccessContent = vi.fn(async () => canAccess);
    const createSignedReadUrl = vi.fn(async () => SIGNED);
    const controller = new GroovesController(
      {} as unknown as GroovesService,
      { canAccessContent } as unknown as EntitlementService,
      { createSignedReadUrl } as unknown as SupabaseService,
    );
    return { controller, createSignedReadUrl, canAccessContent };
  }

  it('signs a valid groove-stems path for a member', async () => {
    const { controller, createSignedReadUrl } = ctrl(true);
    const res = await controller.getStemUrlByPath(VALID_PATH, USER);
    expect(res).toEqual(SIGNED);
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'groove-stems',
      VALID_PATH,
      3600,
    );
  });

  it('accepts a full storage REF url (strips host + bucket prefix)', async () => {
    const { controller, createSignedReadUrl } = ctrl(true);
    await controller.getStemUrlByPath(VALID_REF, USER);
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'groove-stems',
      VALID_PATH,
      3600,
    );
  });

  it('400s on a missing path', async () => {
    const { controller } = ctrl(true);
    await expect(
      controller.getStemUrlByPath(undefined, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('403s for a non-member', async () => {
    const { controller, createSignedReadUrl } = ctrl(false);
    await expect(
      controller.getStemUrlByPath(VALID_PATH, USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('REJECTS a path-traversal attempt (cannot sign arbitrary objects)', async () => {
    const { controller, createSignedReadUrl } = ctrl(true);
    await expect(
      controller.getStemUrlByPath('grooves/../../secrets/key.ogg', USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('REJECTS a different bucket', async () => {
    const { controller, createSignedReadUrl } = ctrl(true);
    await expect(
      controller.getStemUrlByPath(
        'https://x/storage/v1/object/public/audio-samples/grooves/g/c/bass.ogg',
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('REJECTS a non-ogg / malformed path', async () => {
    const { controller } = ctrl(true);
    await expect(
      controller.getStemUrlByPath('grooves/g/c/evil.exe', USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
