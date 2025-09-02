import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExercisesController } from './exercises.controller.js';
import { ExercisesService } from './exercises.service.js';
import { UserBasslinesController } from './user-basslines.controller.js';
import { UserBasslinesService } from './user-basslines.service.js';
import { FileUploadService } from './services/file-upload.service.js';
import { AuthModule } from '../user/auth/auth.module.js';
import { ExerciseRepository } from './repositories/exercise.repository.js';
import { CachedExerciseRepository } from './repositories/cached-exercise.repository.js';
import { ResultExerciseRepository } from './repositories/result-exercise.repository.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Module({
  imports: [AuthModule], // SupabaseModule and CacheModule are now global
  controllers: [ExercisesController, UserBasslinesController],
  providers: [
    ExercisesService,
    UserBasslinesService,
    FileUploadService,
    // Base repository
    {
      provide: ExerciseRepository,
      useFactory: (supabaseService: SupabaseService, requestContext: RequestContextService) => {
        return new ExerciseRepository(supabaseService.getClient(), requestContext);
      },
      inject: [SupabaseService, RequestContextService] },
    // Cached repository (wraps base repository)
    {
      provide: CachedExerciseRepository,
      useFactory: (
        repository: ExerciseRepository,
        cacheService: CacheService,
      ) => {
        return new CachedExerciseRepository(repository, cacheService);
      },
      inject: [ExerciseRepository, CacheService] },
    // Result repository (wraps cached repository)
    {
      provide: 'IResultExerciseRepository',
      useFactory: (
        cachedRepository: CachedExerciseRepository,
        configService: ConfigService,
        requestContext: RequestContextService,
      ) => {
        // Use cached repository if Redis is configured, otherwise use base repository
        const useCache = !!configService.get('REDIS_URL');
        return new ResultExerciseRepository(
          useCache ? cachedRepository : cachedRepository.repository,
          requestContext,
        );
      },
      inject: [CachedExerciseRepository, ConfigService, RequestContextService] },
  ],
  exports: [ExercisesService, UserBasslinesService] })
export class ExercisesModule {
  private readonly staticLogger = createStructuredLogger(ExercisesModule.name);

  constructor() {
    this.staticLogger.debug('ExercisesModule constructor called');
  }

  onModuleInit() {
    this.staticLogger.debug('ExercisesModule initialized');
  }
}
