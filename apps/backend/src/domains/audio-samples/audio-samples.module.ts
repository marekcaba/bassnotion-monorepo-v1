import { Module } from '@nestjs/common';
import { AudioSamplesController } from './audio-samples.controller.js';
import { AudioSamplesService } from './audio-samples.service.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [AudioSamplesController],
  providers: [AudioSamplesService],
  exports: [AudioSamplesService],
})
export class AudioSamplesModule {}