import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ProgressController } from './progress.controller.js';
import { UserProgressController } from './user-progress.controller.js';
import { ProgressService } from './progress.service.js';
import { PracticeService } from './practice.service.js';
import { ProgressRepository } from './repositories/progress.repository.js';
import { PracticeStreakRepository } from './repositories/practice-streak.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { TutorialsModule } from '../tutorials/tutorials.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule, TutorialsModule],
  controllers: [ProgressController, UserProgressController],
  providers: [
    ProgressService,
    ProgressRepository,
    PracticeService,
    PracticeStreakRepository,
  ],
  exports: [ProgressService, PracticeService],
})
export class ProgressModule {}
