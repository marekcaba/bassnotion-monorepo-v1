import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatorsService } from './creators.service.js';
import { CreatorsController } from './creators.controller.js';
import { CreatorRepository } from './repositories/creator.repository.js';
import { CachedCreatorRepository } from './repositories/cached-creator.repository.js';
import { ResultCreatorRepository } from './repositories/result-creator.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [CreatorsController],
  providers: [
    CreatorsService,
    // Base repository
    {
      provide: CreatorRepository,
      useFactory: (
        supabaseService: SupabaseService,
        requestContext: RequestContextService,
      ) => {
        return new CreatorRepository(
          supabaseService.getClient(),
          requestContext,
        );
      },
      inject: [SupabaseService, RequestContextService],
    },
    // Cached repository (wraps base repository)
    {
      provide: CachedCreatorRepository,
      useFactory: (
        repository: CreatorRepository,
        cacheService: CacheService,
      ) => {
        return new CachedCreatorRepository(repository, cacheService);
      },
      inject: [CreatorRepository, CacheService],
    },
    // Result repository (wraps cached repository)
    {
      provide: 'IResultCreatorRepository',
      useFactory: (
        cachedRepository: CachedCreatorRepository,
        configService: ConfigService,
        requestContext: RequestContextService,
      ) => {
        // Use cached repository if Redis is configured, otherwise use base repository
        const useCache = !!configService.get('REDIS_URL');
        return new ResultCreatorRepository(
          useCache ? cachedRepository : cachedRepository.repository,
          requestContext,
        );
      },
      inject: [CachedCreatorRepository, ConfigService, RequestContextService],
    },
  ],
  exports: [CreatorsService],
})
export class CreatorsModule {}
