import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TutorialsController } from './tutorials.controller.js';
import { TutorialsService } from './tutorials.service.js';
import { TutorialRepository } from './repositories/tutorial.repository.js';
import { CachedTutorialRepository } from './repositories/cached-tutorial.repository.js';
import { ResultTutorialRepository } from './repositories/result-tutorial.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [TutorialsController],
  providers: [
    TutorialsService,
    // Base repository
    {
      provide: TutorialRepository,
      useFactory: (supabaseService: SupabaseService, requestContext: RequestContextService) => {
        return new TutorialRepository(supabaseService.getClient(), requestContext);
      },
      inject: [SupabaseService, RequestContextService] },
    // Cached repository (wraps base repository)
    {
      provide: CachedTutorialRepository,
      useFactory: (
        repository: TutorialRepository,
        cacheService: CacheService,
      ) => {
        return new CachedTutorialRepository(repository, cacheService);
      },
      inject: [TutorialRepository, CacheService] },
    // Result repository (wraps cached repository)
    {
      provide: 'IResultTutorialRepository',
      useFactory: (
        cachedRepository: CachedTutorialRepository,
        configService: ConfigService,
        requestContext: RequestContextService,
      ) => {
        // Use cached repository if Redis is configured, otherwise use base repository
        const useCache = !!configService.get('REDIS_URL');
        return new ResultTutorialRepository(
          useCache ? cachedRepository : cachedRepository.repository,
          requestContext,
        );
      },
      inject: [CachedTutorialRepository, ConfigService, RequestContextService] },
  ],
  exports: [TutorialsService] })
export class TutorialsModule {}
