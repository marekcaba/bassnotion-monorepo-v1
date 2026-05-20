import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';
import { ProgressRepository } from './repositories/progress.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { TutorialsModule } from '../tutorials/tutorials.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule, TutorialsModule],
  controllers: [ProgressController],
  providers: [ProgressService, ProgressRepository],
  exports: [ProgressService],
})
export class ProgressModule {}
