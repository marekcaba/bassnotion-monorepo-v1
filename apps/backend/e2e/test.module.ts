import { Module } from '@nestjs/common';

import { SupabaseService } from '../src/infrastructure/supabase/supabase.service.js';
import { AuthController } from '../src/domains/user/auth/auth.controller.js';
import { AuthService } from '../src/domains/user/auth/auth.service.js';
import { AppModule } from '../src/app.module.js';

@Module({
  imports: [AppModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService],
})
export class TestModule {}
