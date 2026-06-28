import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { GymExercise } from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { AdminGymExercisesService } from './admin-gym-exercises.service.js';

/**
 * Student-facing READ of the gym exercise library — the scales/grooves a student picks
 * from in the gym tool. Read-only (list + get); authoring stays on the admin controller.
 * Authenticated but NOT admin-gated: any signed-in user may browse the library. Membership
 * entitlement is enforced where a session is actually run (enroll/today-rep), not on
 * reading what content exists. Reuses AdminGymExercisesService — its list/get carry no
 * admin logic, just reads.
 */
@Controller('api/v1/training-engine/gym-exercises')
@UseGuards(AuthGuard)
export class GymExercisesController {
  constructor(private readonly service: AdminGymExercisesService) {}

  /** List exercises, optionally filtered by ?equipment= and ?kind=. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('equipment') equipment?: string,
    @Query('kind') kind?: string,
  ): Promise<{ exercises: GymExercise[] }> {
    return { exercises: await this.service.list({ equipment, kind }) };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string): Promise<{ exercise: GymExercise }> {
    const exercise = await this.service.get(id);
    if (!exercise) throw new NotFoundException('Gym exercise not found');
    return { exercise };
  }
}
