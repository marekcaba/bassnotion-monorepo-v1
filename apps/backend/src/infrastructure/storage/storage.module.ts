import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller.js';
import { CleanupService } from './cleanup.service.js';
import { AuthModule } from '../../domains/user/auth/auth.module.js';

/**
 * Storage Module - Temporary file storage infrastructure
 * Story 4.4 - Task 2: Temporary MIDI File Storage System
 *
 * Provides temporary file storage capabilities for MIDI files
 * before exercises are saved to database.
 */
@Module({
  imports: [AuthModule], // For AdminGuard
  controllers: [StorageController],
  providers: [CleanupService],
  exports: [CleanupService], // Export for potential external cron usage
})
export class StorageModule {}
