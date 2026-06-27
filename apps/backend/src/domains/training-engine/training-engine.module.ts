import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TrainingEngineController } from './training-engine.controller.js';
import { TrainingEngineService } from './training-engine.service.js';
import { TrainingEngineRepository } from './repositories/training-engine.repository.js';
import { AdminTrainingGoalsController } from './admin-training-goals.controller.js';
import { AdminTrainingGoalsService } from './admin-training-goals.service.js';
import { AdminScaleBlueprintsController } from './admin-scale-blueprints.controller.js';
import { AdminScaleBlueprintsService } from './admin-scale-blueprints.service.js';
import { ScaleBlueprintsRepository } from './repositories/scale-blueprints.repository.js';
import { AdminGymExercisesController } from './admin-gym-exercises.controller.js';
import { AdminGymExercisesService } from './admin-gym-exercises.service.js';
import { GymExercisesRepository } from './repositories/gym-exercises.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { MembershipModule } from '../billing/membership.module.js';

/**
 * Bass Gym Training Engine — backend domain.
 *
 * Owns the RepResultSink server side (`rep_results` append), the
 * virtual-tutorial minting (§7a), the getTodayRep orchestration, and (Phase 5a)
 * the admin authoring CRUD for `training_goals`. The pure climb planner
 * (`generateRep`) lives in `@bassnotion/contracts`. AuthModule is imported for
 * the AdminGuard on the authoring controller.
 *
 * ProgressModule is imported for the StudentState assembler (Treadmill epic,
 * Story 1): it exports PracticeService + ProgressService, the shared-service
 * seam through which the engine reads attendance/streak/lifetime-mastery WITHOUT
 * a cross-domain table query (the product boundary — these become HTTP calls if
 * Practice Bridge extracts).
 */
@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    AuthModule,
    ProgressModule,
    // MembershipModule exports SubscriptionRepository — the gym is the monthly
    // membership product's entitlement: enroll/today-rep require an active
    // subscription, and the goal window binds to the subscription's billing
    // period (currentPeriodEnd). See enrollInGoal / getTodayRep.
    MembershipModule,
  ],
  controllers: [
    TrainingEngineController,
    AdminTrainingGoalsController,
    AdminScaleBlueprintsController,
    AdminGymExercisesController,
  ],
  providers: [
    TrainingEngineService,
    TrainingEngineRepository,
    AdminTrainingGoalsService,
    AdminScaleBlueprintsService,
    ScaleBlueprintsRepository,
    AdminGymExercisesService,
    GymExercisesRepository,
  ],
  exports: [TrainingEngineService],
})
export class TrainingEngineModule {}
