import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type {
  ScaleBlueprintRecord,
  UpdateScaleBlueprintInput,
} from '@bassnotion/contracts';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { AdminScaleBlueprintsService } from './admin-scale-blueprints.service.js';

/**
 * Admin authoring for the gym Scales tool's blueprints (box shapes + rhythm),
 * the visual editor at /admin/scales. Admin-gated; writes use the service-role
 * client (the AdminGuard is the real boundary). Editing a blueprint takes effect
 * for everyone immediately — the runtime reads the stored shape live.
 */
@Controller('api/v1/training-engine/admin/scales/blueprints')
@UseGuards(AdminGuard)
export class AdminScaleBlueprintsController {
  constructor(private readonly service: AdminScaleBlueprintsService) {}

  /** Every scale's current blueprint (the editor lists them all). */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<{ blueprints: ScaleBlueprintRecord[] }> {
    return { blueprints: await this.service.list() };
  }

  /** Replace one scale's positions and/or rhythm. */
  @Patch(':scaleType')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('scaleType') scaleType: string,
    @Body() patch: UpdateScaleBlueprintInput,
  ): Promise<{ blueprint: ScaleBlueprintRecord }> {
    return { blueprint: await this.service.update(scaleType, patch) };
  }
}
