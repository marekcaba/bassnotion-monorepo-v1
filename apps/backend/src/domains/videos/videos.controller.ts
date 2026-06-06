import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { OptionalAuthGuard } from '../user/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { EntitlementService } from '../billing/services/entitlement.service.js';
import { BunnyVideoService } from './bunny-video.service.js';
import { VideoRepository } from './video.repository.js';

export interface PlaybackUrlResponse {
  embedUrl: string;
  expires: number;
}

/**
 * Mints a short-lived, entitlement-checked Bunny embed URL for a video.
 *
 * This is the ONLY supported way for the frontend to obtain a playable video
 * URL once Bunny token-auth is enabled. Flow:
 *   1. OptionalAuthGuard — anon allowed (free videos must play logged-out)
 *   2. Look up the video's tier (absent → FREE; opt-in gating)
 *   3. EntitlementService.canAccessContent → 403 if the user can't access it
 *   4. BunnyVideoService.signEmbedUrl → { embedUrl, expires }
 */
@Controller('api/v1/videos')
@UseGuards(OptionalAuthGuard)
export class VideosController {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly bunnyVideoService: BunnyVideoService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get(':videoId/playback-url')
  async getPlaybackUrl(
    @Param('videoId') videoId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query('libraryId') libraryIdQuery?: string,
  ): Promise<PlaybackUrlResponse> {
    if (!this.bunnyVideoService.isConfigured()) {
      // Misconfiguration is operator error, not a client error.
      throw new ServiceUnavailableException('Video signing is not configured');
    }

    // Tier resolution: registered video → its tier+library; otherwise FREE,
    // and fall back to the caller-supplied / default library for the URL.
    const registered = await this.videoRepository.findByBunnyVideoId(videoId);
    const content = registered
      ? { accessTier: registered.accessTier, productId: registered.productId }
      : { accessTier: 'free' as const, productId: null };
    const libraryId = registered?.bunnyLibraryId ?? libraryIdQuery;

    const allowed = await this.entitlementService.canAccessContent(
      user?.id ?? null,
      content,
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have access to this video',
        requiredTier: content.accessTier,
        productId: content.productId ?? undefined,
      });
    }

    const nowSeconds = Date.now() / 1000;
    return this.bunnyVideoService.signEmbedUrl(videoId, libraryId, nowSeconds);
  }
}
