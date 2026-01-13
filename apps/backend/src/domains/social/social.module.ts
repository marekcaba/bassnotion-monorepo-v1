/**
 * Social Module
 *
 * Provides exercise likes (public) and favorites (private) functionality.
 */

import { Module } from '@nestjs/common';
import { LikeController } from './controllers/like.controller.js';
import { FavoriteController } from './controllers/favorite.controller.js';
import { LikeService } from './services/like.service.js';
import { FavoriteService } from './services/favorite.service.js';
import { LikeRepository } from './repositories/like.repository.js';
import { FavoriteRepository } from './repositories/favorite.repository.js';
import { AuthModule } from '../user/auth/auth.module.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@Module({
  imports: [AuthModule],
  controllers: [LikeController, FavoriteController],
  providers: [
    LikeService,
    FavoriteService,
    // Like Repository
    {
      provide: 'LikeRepository',
      useFactory: (
        supabaseService: SupabaseService,
        requestContext: RequestContextService,
      ) => {
        return new LikeRepository(supabaseService.getClient(), requestContext);
      },
      inject: [SupabaseService, RequestContextService],
    },
    // Favorite Repository
    {
      provide: 'FavoriteRepository',
      useFactory: (
        supabaseService: SupabaseService,
        requestContext: RequestContextService,
      ) => {
        return new FavoriteRepository(
          supabaseService.getClient(),
          requestContext,
        );
      },
      inject: [SupabaseService, RequestContextService],
    },
  ],
  exports: [LikeService, FavoriteService],
})
export class SocialModule {
  private readonly staticLogger = createStructuredLogger(SocialModule.name);

  constructor() {
    this.staticLogger.debug('SocialModule constructor called');
  }

  onModuleInit() {
    this.staticLogger.debug('SocialModule initialized');
  }
}
