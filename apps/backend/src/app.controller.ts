import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service.js';
import { DatabaseService } from './infrastructure/database/database.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/health')
  getHealth(): {
    status: string;
    timestamp: string;
    message: string;
    database: string;
  } {
    const dbStatus = this.databaseService.isReady()
      ? 'connected'
      : 'disconnected';

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'BassNotion Backend is running',
      database: dbStatus,
    };
  }

  @Get('api/debug/modules')
  getModules() {
    // This will help us see if UserController routes are being registered
    return {
      message: 'Debug: Check if UserController routes are available',
      expectedRoutes: [
        'PUT /user/profile',
        'DELETE /user/account'
      ],
      instructions: 'Try accessing these routes to see if they exist'
    };
  }
}
