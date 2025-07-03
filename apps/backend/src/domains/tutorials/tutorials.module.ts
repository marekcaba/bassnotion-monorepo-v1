import { Module } from '@nestjs/common';
import { TutorialsController } from './tutorials.controller.js';
import { TutorialsService } from './tutorials.service.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  controllers: [TutorialsController],
  providers: [TutorialsService],
  exports: [TutorialsService],
})
export class TutorialsModule {}
