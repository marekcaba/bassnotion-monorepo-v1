import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { CreatorsService } from './creators.service.js';

@Controller('api/creators')
export class CreatorsController {
  private readonly logger = new Logger(CreatorsController.name);

  constructor(private readonly creatorsService: CreatorsService) {}

  /**
   * GET /api/creators/stats?channelUrl=...
   * Get cached creator statistics for a specific channel
   */
  @Get('stats')
  async getCreatorStats(@Query('channelUrl') channelUrl: string) {
    if (!channelUrl) {
      return { error: 'channelUrl query parameter is required' };
    }

    try {
      const stats = await this.creatorsService.getCreatorStats(channelUrl);

      if (!stats) {
        return {
          error: 'Creator stats not found',
          fallback: {
            creatorName: 'Creator',
            subscriberCountFormatted: 'Subscribe',
          },
        };
      }

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error fetching creator stats:', error);
      return {
        error: 'Failed to fetch creator stats',
        fallback: {
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        },
      };
    }
  }

  /**
   * POST /api/creators/batch-update
   * Trigger manual batch update of all creator statistics
   * (Typically called by cron job, but available for manual triggers)
   */
  @Post('batch-update')
  async triggerBatchUpdate() {
    try {
      this.logger.log('Manual batch update triggered');
      await this.creatorsService.updateAllCreatorStats();

      return {
        success: true,
        message: 'Batch update completed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error in manual batch update:', error);
      return {
        error: 'Batch update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/creators/health
   * Check health of creator stats system
   */
  @Get('health')
  async getHealthStatus() {
    try {
      const staleChannels =
        await this.creatorsService.getStaleCreatorChannels();
      const allChannels = await this.creatorsService.getAllCreatorChannels();

      return {
        success: true,
        stats: {
          totalChannels: allChannels.length,
          staleChannels: staleChannels.length,
          freshChannels: allChannels.length - staleChannels.length,
          lastUpdate: new Date().toISOString(),
        },
        needsUpdate: staleChannels.length > 0,
      };
    } catch (error) {
      this.logger.error('Error checking health status:', error);
      return {
        error: 'Failed to check health status',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
