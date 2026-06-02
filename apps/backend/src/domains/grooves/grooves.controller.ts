/**
 * Grooves Controller — REST API for the reusable groove library.
 *
 * Public: list active grooves + get one (so the admin block-editor picker and
 * the public tutorial fetch can read them). Admin-only: create + update.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { GroovesService } from './grooves.service.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  CreateGrooveInput,
  UpdateGrooveInput,
} from '@bassnotion/contracts';

@Controller('api/v1/grooves')
export class GroovesController {
  private readonly logger = createStructuredLogger(GroovesController.name);

  constructor(private readonly groovesService: GroovesService) {}

  /** GET /api/v1/grooves/library — list grooves (active by default). */
  @Get('library')
  @UseGuards(AuthGuard)
  async listGrooves(@Query('includeInactive') includeInactive?: string) {
    return this.groovesService.listGrooves(includeInactive === 'true');
  }

  /** GET /api/v1/grooves/library/:id — fetch a single groove. */
  @Get('library/:id')
  async getGroove(@Param('id') id: string) {
    const groove = await this.groovesService.getGrooveById(id);
    return { groove };
  }

  /** POST /api/v1/grooves/library — create a groove (admin). */
  @Post('library')
  @UseGuards(AdminGuard)
  async createGroove(@Body() input: CreateGrooveInput) {
    this.logger.info('Creating groove', { name: input.name });
    const groove = await this.groovesService.createGroove(input);
    return { groove };
  }

  /** PATCH /api/v1/grooves/library/:id — update a groove (admin). */
  @Patch('library/:id')
  @UseGuards(AdminGuard)
  async updateGroove(
    @Param('id') id: string,
    @Body() input: UpdateGrooveInput,
  ) {
    const groove = await this.groovesService.updateGroove(id, input);
    return { groove };
  }
}
