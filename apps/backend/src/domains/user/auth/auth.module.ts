import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../infrastructure/database/database.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthSecurityService } from './services/auth-security.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AuthSecurityService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
