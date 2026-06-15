import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
} from '@bassnotion/contracts';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { AdminTrainingGoalsService } from './admin-training-goals.service.js';

/**
 * Admin authoring for training goals (Phase 5a) — create/edit/delete the goals
 * the engine plans from, no seed SQL. All admin-gated; writes use the
 * service-role client (the AdminGuard is the real boundary). Editing a goal
 * never disturbs an in-flight climb (enrollments hold a frozen snapshot).
 */
@Controller('api/v1/training-engine/admin/goals')
@UseGuards(AdminGuard)
export class AdminTrainingGoalsController {
  constructor(private readonly service: AdminTrainingGoalsService) {}

  /** List ALL goals (incl. inactive) for the admin table. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<{ goals: Goal[] }> {
    return { goals: await this.service.list() };
  }

  /** One goal (admin edit view). */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string): Promise<{ goal: Goal }> {
    const goal = await this.service.get(id);
    if (!goal) throw new NotFoundException('Training goal not found');
    return { goal };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateGoalInput): Promise<{ goal: Goal }> {
    return { goal: await this.service.create(input) };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() patch: UpdateGoalInput,
  ): Promise<{ goal: Goal }> {
    return { goal: await this.service.update(id, patch) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.remove(id);
    return { ok: true };
  }
}
