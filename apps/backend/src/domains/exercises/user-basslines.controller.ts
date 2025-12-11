import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { UserBasslinesService } from './user-basslines.service.js';

@Controller('api/user-basslines')
@UseGuards(AuthGuard)
export class UserBasslinesController {
  constructor(private readonly userBasslinesService: UserBasslinesService) {}

  /**
   * Get user's saved basslines with optional filtering
   * GET /api/user-basslines?search=&difficulty=&tags=&sortBy=&sortOrder=&page=&limit=
   */
  @Get()
  async getUserBasslines(@Request() req: any, @Query() filters: any) {
    const userId = req.user?.id;
    return this.userBasslinesService.getUserBasslines(userId, filters);
  }

  /**
   * Get a specific bassline by ID
   * GET /api/user-basslines/:id
   */
  @Get(':id')
  async getBasslineById(@Request() req: any, @Param('id') basslineId: string) {
    const userId = req.user?.id;
    return this.userBasslinesService.getBasslineById(userId, basslineId);
  }

  /**
   * Save a new bassline or overwrite existing
   * POST /api/user-basslines
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async saveBassline(@Request() req: any, @Body() requestData: any) {
    const userId = req.user?.id;
    return this.userBasslinesService.saveBassline(userId, requestData);
  }

  /**
   * Auto-save a bassline (for work-in-progress)
   * POST /api/user-basslines/auto-save
   */
  @Post('auto-save')
  @HttpCode(HttpStatus.OK)
  async autoSave(@Request() req: any, @Body() requestData: any) {
    const userId = req.user?.id;
    return this.userBasslinesService.autoSave(userId, requestData);
  }

  /**
   * Rename a bassline
   * PUT /api/user-basslines/:id/rename
   */
  @Put(':id/rename')
  async renameBassline(
    @Request() req: any,
    @Param('id') basslineId: string,
    @Body() requestData: any,
  ) {
    const userId = req.user?.id;
    return this.userBasslinesService.renameBassline(
      userId,
      basslineId,
      requestData,
    );
  }

  /**
   * Duplicate a bassline
   * POST /api/user-basslines/:id/duplicate
   */
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicateBassline(
    @Request() req: any,
    @Param('id') basslineId: string,
    @Body() requestData: any,
  ) {
    const userId = req.user?.id;
    return this.userBasslinesService.duplicateBassline(
      userId,
      basslineId,
      requestData,
    );
  }

  /**
   * Delete a bassline (soft delete)
   * DELETE /api/user-basslines/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBassline(@Request() req: any, @Param('id') basslineId: string) {
    const userId = req.user?.id;
    await this.userBasslinesService.deleteBassline(userId, basslineId);
  }
}
