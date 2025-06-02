import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { UserController } from './user.controller.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [UserController],
  exports: [AuthModule],
})
export class UserModule {}
