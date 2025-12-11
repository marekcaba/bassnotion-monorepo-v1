import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from './auth/auth.module.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { CachedUserRepository } from './repositories/cached-user.repository.js';
import { ResultUserRepository } from './repositories/result-user.repository.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [UserController],
  providers: [
    UserService,
    // Base repository
    {
      provide: UserRepository,
      useFactory: (
        supabaseService: SupabaseService,
        requestContext: RequestContextService,
      ) => {
        return new UserRepository(supabaseService.getClient(), requestContext);
      },
      inject: [SupabaseService, RequestContextService],
    },
    // Cached repository (wraps base repository)
    {
      provide: CachedUserRepository,
      useFactory: (repository: UserRepository, cacheService: CacheService) => {
        return new CachedUserRepository(repository, cacheService);
      },
      inject: [UserRepository, CacheService],
    },
    // Result repository (wraps cached repository)
    {
      provide: 'IResultUserRepository',
      useFactory: (
        cachedRepository: CachedUserRepository,
        configService: ConfigService,
        requestContext: RequestContextService,
      ) => {
        // Use cached repository if Redis is configured, otherwise use base repository
        const useCache = !!configService.get('REDIS_URL');
        return new ResultUserRepository(
          useCache ? cachedRepository : cachedRepository.repository,
          requestContext,
        );
      },
      inject: [CachedUserRepository, ConfigService, RequestContextService],
    },
  ],
  exports: [AuthModule, UserService, 'IResultUserRepository'],
})
export class UserModule {}
