import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { GetTutorialProgressResponse } from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { ProgressService } from './progress.service.js';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

@Controller('api/v1/tutorials')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * GET /api/v1/tutorials/:slug/progress
   *
   * Returns the current user's progress for the given tutorial, with
   * server-computed unlock state per block. The frontend uses this as the
   * single source of truth for what's completed and what's accessible.
   */
  @Get(':slug/progress')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTutorialProgress(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
  ): Promise<GetTutorialProgressResponse> {
    return this.progressService.getTutorialProgress(user.id, slug);
  }
}
