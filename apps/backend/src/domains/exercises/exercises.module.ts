import { Module, Logger } from '@nestjs/common';
import { ExercisesController } from './exercises.controller.js';
import { ExercisesService } from './exercises.service.js';
import { AuthModule } from '../user/auth/auth.module.js';

@Module({
  imports: [AuthModule], // SupabaseModule is now global, no need to import it
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {
  private readonly logger = new Logger(ExercisesModule.name);

  constructor() {
    this.logger.debug('ExercisesModule constructor called');
  }

  onModuleInit() {
    this.logger.debug('ExercisesModule initialized');
  }
}
