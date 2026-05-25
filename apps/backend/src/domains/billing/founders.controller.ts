import { Controller, Get, Logger } from '@nestjs/common';

import { FounderMemberRepository } from './repositories/founder-member.repository.js';

const FOUNDER_TOTAL_SPOTS = 100;

@Controller('api/v1/founders')
export class FoundersController {
  private readonly logger = new Logger(FoundersController.name);

  constructor(
    private readonly founderMemberRepository: FounderMemberRepository,
  ) {}

  /**
   * Public counter for the "X of 100 spots claimed" UI on the marketing
   * waitlist. Returns the live-mode count only (test purchases aren't
   * shown to visitors). Bounded by FOUNDER_TOTAL_SPOTS so a runaway count
   * can never render over 100.
   *
   * On error, we degrade gracefully and return the last-known value via
   * the `error` flag so the frontend can choose to keep showing the
   * previous number rather than flicker to zero.
   */
  @Get('count')
  async getFounderCount(): Promise<{
    claimed: number;
    total: number;
    error: false | string;
  }> {
    try {
      const claimed = await this.founderMemberRepository.countByMode('live');
      return {
        claimed: Math.min(claimed, FOUNDER_TOTAL_SPOTS),
        total: FOUNDER_TOTAL_SPOTS,
        error: false,
      };
    } catch (err) {
      this.logger.error('Failed to read founder count', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        claimed: 0,
        total: FOUNDER_TOTAL_SPOTS,
        error: 'count_unavailable',
      };
    }
  }
}
