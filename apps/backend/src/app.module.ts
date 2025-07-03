import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './domains/user/auth/auth.module.js';
import { UserModule } from './domains/user/user.module.js';
import { ExercisesModule } from './domains/exercises/exercises.module.js';
import { TutorialsModule } from './domains/tutorials/tutorials.module.js';
import { CreatorsModule } from './domains/creators/creators.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { SupabaseModule } from './infrastructure/supabase/supabase.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    SupabaseModule,
    AuthModule,
    UserModule,
    ExercisesModule,
    TutorialsModule,
    CreatorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
