import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/debug/modules')
  getModules() {
    // This will help us see if UserController routes are being registered
    return {
      message: 'Debug: Check if UserController routes are available',
      expectedRoutes: ['PUT /user/profile', 'DELETE /user/account'],
      instructions: 'Try accessing these routes to see if they exist' };
  }
}
