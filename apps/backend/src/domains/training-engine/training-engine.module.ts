import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TrainingEngineController } from './training-engine.controller.js';
import { TrainingEngineService } from './training-engine.service.js';
import { TrainingEngineRepository } from './repositories/training-engine.repository.js';
import { AdminTrainingGoalsController } from './admin-training-goals.controller.js';
import { AdminTrainingGoalsService } from './admin-training-goals.service.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';

/**
 * Bass Gym Training Engine — backend domain.
 *
 * Owns the RepResultSink server side (`rep_results` append), the
 * virtual-tutorial minting (§7a), the getTodayRep orchestration, and (Phase 5a)
 * the admin authoring CRUD for `training_goals`. The pure climb planner
 * (`generateRep`) lives in `@bassnotion/contracts`. AuthModule is imported for
 * the AdminGuard on the authoring controller.
 */
@Module({
  imports: [ConfigModule, SupabaseModule, AuthModule],
  controllers: [TrainingEngineController, AdminTrainingGoalsController],
  providers: [
    TrainingEngineService,
    TrainingEngineRepository,
    AdminTrainingGoalsService,
  ],
  exports: [TrainingEngineService],
})
export class TrainingEngineModule {}
