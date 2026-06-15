import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TrainingEngineController } from './training-engine.controller.js';
import { TrainingEngineService } from './training-engine.service.js';
import { TrainingEngineRepository } from './repositories/training-engine.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

/**
 * Bass Gym Training Engine — backend domain (Phase 1 seam).
 *
 * Owns the RepResultSink server side (`rep_results` append) and the
 * virtual-tutorial minting (§7a). The pure climb planner (`generateRep`) lives
 * in `@bassnotion/contracts` and is orchestrated here in a later phase once
 * authored goals + climb_states reads land.
 */
@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [TrainingEngineController],
  providers: [TrainingEngineService, TrainingEngineRepository],
  exports: [TrainingEngineService],
})
export class TrainingEngineModule {}
