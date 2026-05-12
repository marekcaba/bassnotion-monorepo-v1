import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { JourneyController } from './journey.controller.js';
import { JourneyService } from './journey.service.js';
import { JourneyRepository } from './repositories/journey.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [JourneyController],
  providers: [JourneyService, JourneyRepository],
  exports: [JourneyService, JourneyRepository],
})
export class JourneyModule {}
