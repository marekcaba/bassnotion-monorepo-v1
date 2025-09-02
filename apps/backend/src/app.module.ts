import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './domains/user/auth/auth.module.js';
import { UserModule } from './domains/user/user.module.js';
import { ExercisesModule } from './domains/exercises/exercises.module.js';
import { TutorialsModule } from './domains/tutorials/tutorials.module.js';
import { CreatorsModule } from './domains/creators/creators.module.js';
import { AudioSamplesModule } from './domains/audio-samples/audio-samples.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { SupabaseModule } from './infrastructure/supabase/supabase.module.js';
import { CacheModule } from './infrastructure/cache/cache.module.js';
import { HealthModule } from './health/health.module.js';
import { PerformanceMiddleware } from './shared/middleware/performance.middleware.js';
import { CorrelationMiddleware } from './shared/middleware/correlation.middleware.js';
import { SharedModule } from './shared/shared.module.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true }),
    SharedModule, // Global module for shared services
    LoggingModule, // Global logging infrastructure
    DatabaseModule,
    SupabaseModule,
    CacheModule,
    AuthModule,
    UserModule,
    ExercisesModule,
    TutorialsModule,
    CreatorsModule,
    AudioSamplesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService, PerformanceMiddleware, CorrelationMiddleware] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply CorrelationMiddleware first to set up correlation IDs
    consumer
      .apply(CorrelationMiddleware, PerformanceMiddleware)
      .exclude('/api/health', '/api/health/(.*)')
      .forRoutes('*');
  }
}
