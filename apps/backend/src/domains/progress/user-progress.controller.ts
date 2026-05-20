import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { GetUserTutorialCompletionsResponse } from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { ProgressService } from './progress.service.js';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * User-scoped progress endpoints. Lives at /api/v1/users/me/... because the
 * resource isn't tied to a specific tutorial — it's "this user's progress
 * across all tutorials." Kept separate from ProgressController which is
 * under /api/v1/tutorials/:slug/... .
 */
@Controller('api/v1/users/me')
export class UserProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * GET /api/v1/users/me/tutorial-completions
   *
   * Per-tutorial rollup for the library / sidebar. Returns one summary
   * entry per active tutorial with computed isComplete + per-block dots.
   */
  @Get('tutorial-completions')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserTutorialCompletions(
    @CurrentUser() user: AuthUser,
  ): Promise<GetUserTutorialCompletionsResponse> {
    return this.progressService.getUserTutorialCompletions(user.id);
  }
}
