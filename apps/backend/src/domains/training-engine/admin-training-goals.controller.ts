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
  Goal,
  AdminGoalSummary,
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

  /** The admin table — non-archived goals, each with its live enrollment count. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<{ goals: AdminGoalSummary[] }> {
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

  /** Archive a goal (soft-delete): off the list + not enrollable, reversible. */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string): Promise<{ goal: Goal }> {
    return { goal: await this.service.archive(id) };
  }

  /** Unarchive a goal — bring it back to the list. */
  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  async unarchive(@Param('id') id: string): Promise<{ goal: Goal }> {
    return { goal: await this.service.unarchive(id) };
  }

  /**
   * Hard-delete a goal. Guarded: refused when enrollments exist unless
   * `?force=true` (the admin override for test/junk goals — cascades the
   * enrollments + climbs + reps deliberately).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Query('force') force?: string,
  ): Promise<{ ok: true }> {
    await this.service.remove(id, force === 'true');
    return { ok: true };
  }
}
