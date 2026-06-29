import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type {
  GymExercise,
  CreateGymExerciseInput,
  UpdateGymExerciseInput,
} from '@bassnotion/contracts';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { AdminGymExercisesService } from './admin-gym-exercises.service.js';

/**
 * Admin authoring for gym equipment exercises (scale paths, grooves) — the editor at
 * /admin/scales. Generic + draft-friendly: save partial progress freely. Admin-gated;
 * writes use the service-role client (AdminGuard is the real boundary).
 */
@Controller('api/v1/training-engine/admin/gym-exercises')
@UseGuards(AdminGuard)
export class AdminGymExercisesController {
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() input: CreateGymExerciseInput,
  ): Promise<{ exercise: GymExercise }> {
    return { exercise: await this.service.create(input) };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() patch: UpdateGymExerciseInput,
  ): Promise<{ exercise: GymExercise }> {
    return { exercise: await this.service.update(id, patch) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.remove(id);
    return { ok: true };
  }
}
