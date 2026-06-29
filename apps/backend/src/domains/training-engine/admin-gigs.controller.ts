import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Gig, CreateGigInput, UpdateGigInput } from '@bassnotion/contracts';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { TakeRecordingsRepository } from './repositories/take-recordings.repository.js';

/**
 * Admin authoring for gym GIGS — the goal-bound "submit this" deliverables the admin authors
 * on a goal (at /admin/...). Every student enrolled in the goal inherits the gig, scheduled by
 * a cycle-day offset. Admin-gated; writes use the service-role client (AdminGuard is the real
 * boundary). `createdBy` is stamped from the authenticated admin — never trusted from the body.
 */
@Controller('api/v1/training-engine/admin/gigs')
@UseGuards(AdminGuard)
export class AdminGigsController {
  constructor(private readonly repo: TakeRecordingsRepository) {}

  /** List every gig (active + disabled) for the management UI; optionally scope to one goal. */
  @Get()
  async listGigs(
    @Query('goalId') goalId?: string,
  ): Promise<{ gigs: Gig[] }> {
    const gigs = await this.repo.adminListGigs(goalId);
    return { gigs };
  }

  /** Create a gig on a goal. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGig(
    @Body() input: CreateGigInput,
    @CurrentUser() user: AuthUser,
  ): Promise<{ gig: Gig }> {
    const gig = await this.repo.createGig({
      ...input,
      createdBy: user.id,
    });
    return { gig };
  }

  /** Edit a gig's parameters (partial). 404 if the id doesn't exist. */
  @Patch(':id')
  async updateGig(
    @Param('id') id: string,
    @Body() patch: UpdateGigInput,
  ): Promise<{ gig: Gig }> {
    const gig = await this.repo.updateGig(id, patch);
    if (!gig) {
      throw new NotFoundException(`Gig ${id} not found`);
    }
    return { gig };
  }

  /** Delete a gig. Submitted takes survive (gig_id → SET NULL). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGig(@Param('id') id: string): Promise<void> {
    await this.repo.deleteGig(id);
  }
}
