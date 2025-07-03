import { Module } from '@nestjs/common';
import { CreatorsService } from './creators.service.js';
import { CreatorsController } from './creators.controller.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
