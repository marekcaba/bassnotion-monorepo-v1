import { Module, Logger, forwardRef } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthSecurityService } from './services/auth-security.service.js';
import { PasswordSecurityService } from './services/password-security.service.js';
import { DatabaseModule } from '../../../infrastructure/database/database.module.js';

@Module({
  imports: [forwardRef(() => DatabaseModule)],
  controllers: [AuthController],
  providers: [
    PasswordSecurityService,
    AuthSecurityService,
    AuthService,
    AuthGuard,
  ],
  exports: [
    AuthService,
    AuthGuard,
    PasswordSecurityService,
    AuthSecurityService,
  ],
})
export class AuthModule {
  private readonly logger = new Logger(AuthModule.name);

  constructor() {
    this.logger.debug('AuthModule constructor called');
  }

  onModuleInit() {
    this.logger.debug('AuthModule initialized');
  }
}
