import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { VideosController } from './videos.controller.js';
import { BunnyVideoService } from './bunny-video.service.js';
import { VideoRepository } from './video.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';

/**
 * VideosModule — entitlement-gated Bunny video playback signing.
 * - AuthModule       → OptionalAuthGuard / AuthGuard
 * - BillingModule    → EntitlementService (re-exported)
 * - SupabaseModule   → VideoRepository's service-role client
 */
@Module({
  imports: [ConfigModule, SupabaseModule, AuthModule, BillingModule],
  controllers: [VideosController],
  providers: [BunnyVideoService, VideoRepository],
  exports: [BunnyVideoService, VideoRepository],
})
export class VideosModule {}
