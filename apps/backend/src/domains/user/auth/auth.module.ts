import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../infrastructure/database/database.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
// Temporarily commented out for Railway deployment - module resolution issue
// import { AuthSecurityService } from './services/auth-security.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
