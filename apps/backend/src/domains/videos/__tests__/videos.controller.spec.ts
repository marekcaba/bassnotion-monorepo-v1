import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

import { VideosController } from '../videos.controller.js';
import type { BunnyVideoService } from '../bunny-video.service.js';
import type { VideoRepository, VideoAccess } from '../video.repository.js';
import type { EntitlementService } from '../../billing/services/entitlement.service.js';
import type { AuthUser } from '../../user/auth/types/auth.types.js';

const VIDEO = 'vid-123';
const SIGNED = { embedUrl: 'https://iframe.mediadelivery.net/embed/L/vid-123?token=t&expires=9', expires: 9 };

function makeController(opts: {
  configured?: boolean;
  registered?: VideoAccess | null;
  allowed?: boolean;
}) {
  const isConfigured = vi.fn(() => opts.configured ?? true);
  const signEmbedUrl = vi.fn(() => SIGNED);
  const findByBunnyVideoId = vi.fn(async () => opts.registered ?? null);
  const canAccessContent = vi.fn(async () => opts.allowed ?? true);

  const controller = new VideosController(
    { findByBunnyVideoId } as unknown as VideoRepository,
    { isConfigured, signEmbedUrl } as unknown as BunnyVideoService,
    { canAccessContent } as unknown as EntitlementService,
  );
  return { controller, signEmbedUrl, findByBunnyVideoId, canAccessContent };
}

const anon = undefined;
const member = { id: 'user-1' } as AuthUser;

describe('VideosController.getPlaybackUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('503 when signing key is not configured', async () => {
    const { controller } = makeController({ configured: false });
    await expect(controller.getPlaybackUrl(VIDEO, anon)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('un-registered video is treated as FREE → anon gets a signed URL', async () => {
    const { controller, canAccessContent, signEmbedUrl } = makeController({
      registered: null,
      allowed: true,
    });
    const res = await controller.getPlaybackUrl(VIDEO, anon, 'lib-q');
    expect(canAccessContent).toHaveBeenCalledWith(null, {
      accessTier: 'free',
      productId: null,
    });
    expect(signEmbedUrl).toHaveBeenCalled();
    expect(res).toEqual(SIGNED);
  });

  it('registered MEMBER video + anon (denied) → 403', async () => {
    const { controller, signEmbedUrl } = makeController({
      registered: {
        bunnyVideoId: VIDEO,
        bunnyLibraryId: 'L',
        accessTier: 'member',
        productId: null,
      },
      allowed: false,
    });
    await expect(controller.getPlaybackUrl(VIDEO, anon)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(signEmbedUrl).not.toHaveBeenCalled();
  });

  it('registered MEMBER video + entitled user → signed URL', async () => {
    const { controller, canAccessContent, signEmbedUrl } = makeController({
      registered: {
        bunnyVideoId: VIDEO,
        bunnyLibraryId: 'L',
        accessTier: 'member',
        productId: null,
      },
      allowed: true,
    });
    const res = await controller.getPlaybackUrl(VIDEO, member);
    expect(canAccessContent).toHaveBeenCalledWith('user-1', {
      accessTier: 'member',
      productId: null,
    });
    expect(res).toEqual(SIGNED);
  });

  it('registered PRODUCT video, user lacks ownership → 403 carries the tier/product', async () => {
    const { controller } = makeController({
      registered: {
        bunnyVideoId: VIDEO,
        bunnyLibraryId: 'L',
        accessTier: 'product',
        productId: 'pack-a',
      },
      allowed: false,
    });
    await expect(controller.getPlaybackUrl(VIDEO, member)).rejects.toMatchObject(
      {
        response: { requiredTier: 'product', productId: 'pack-a' },
      },
    );
  });

  it('uses the REGISTERED library id over the query param', async () => {
    const { controller, signEmbedUrl } = makeController({
      registered: {
        bunnyVideoId: VIDEO,
        bunnyLibraryId: 'registered-lib',
        accessTier: 'free',
        productId: null,
      },
      allowed: true,
    });
    await controller.getPlaybackUrl(VIDEO, anon, 'query-lib');
    expect(signEmbedUrl).toHaveBeenCalledWith(
      VIDEO,
      'registered-lib',
      expect.any(Number),
    );
  });
});
