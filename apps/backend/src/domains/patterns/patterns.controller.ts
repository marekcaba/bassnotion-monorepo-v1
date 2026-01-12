/**
 * Patterns Controller
 * REST API endpoints for the drum pattern library
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PatternsService } from './patterns.service.js';
import {
  GetPatternsQueryDto,
  PatternLibraryResponseDto,
  PatternLibraryItemResponseDto,
  CreatePatternDto,
} from './dto/pattern-library.dto.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@ApiTags('patterns')
@Controller('api/v1/patterns')
export class PatternsController {
  private readonly logger = createStructuredLogger(PatternsController.name);

  constructor(private readonly patternsService: PatternsService) {}

  /**
   * GET /api/v1/patterns/library
   * Get patterns from the library with optional filtering
   * Public endpoint - no authentication required
   */
  @Get('library')
  @ApiOperation({ summary: 'Get patterns from the library' })
  @ApiResponse({
    status: 200,
    description: 'List of patterns matching the filter',
    type: PatternLibraryResponseDto,
  })
  async getPatterns(
    @Query() query: GetPatternsQueryDto,
  ): Promise<PatternLibraryResponseDto> {
    this.logger.info('GET /api/v1/patterns/library - Fetching patterns', {
      genre: query.genre,
      difficulty: query.difficulty,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return this.patternsService.getPatterns({
      genre: query.genre,
      difficulty: query.difficulty,
      timeSignatureNumerator: query.timeSignatureNumerator,
      timeSignatureDenominator: query.timeSignatureDenominator,
      bars: query.bars,
      bpm: query.bpm,
      search: query.search,
      tags: query.tags,
      featured: query.featured,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * GET /api/v1/patterns/library/:id
   * Get a single pattern by ID
   * Public endpoint - no authentication required
   */
  @Get('library/:id')
  @ApiOperation({ summary: 'Get a pattern by ID' })
  @ApiParam({ name: 'id', description: 'Pattern ID' })
  @ApiResponse({
    status: 200,
    description: 'Pattern details',
    type: PatternLibraryItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Pattern not found' })
  async getPatternById(
    @Param('id') id: string,
  ): Promise<PatternLibraryItemResponseDto> {
    this.logger.info(`GET /api/v1/patterns/library/${id} - Fetching pattern`);

    const pattern = await this.patternsService.getPatternById(id);

    return { pattern };
  }

  /**
   * POST /api/v1/patterns/library
   * Create a new pattern in the library
   * Requires authentication
   */
  @Post('library')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new pattern in the library' })
  @ApiResponse({
    status: 201,
    description: 'Pattern created successfully',
    type: PatternLibraryItemResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createPattern(
    @Body() createPatternDto: CreatePatternDto,
  ): Promise<PatternLibraryItemResponseDto> {
    this.logger.info('POST /api/v1/patterns/library - Creating pattern', {
      name: createPatternDto.name,
      genre: createPatternDto.genre,
      difficulty: createPatternDto.difficulty,
    });

    const pattern = await this.patternsService.createPattern(createPatternDto);

    return { pattern };
  }

  /**
   * POST /api/v1/patterns/library/:id/use
   * Record pattern usage (increment counter)
   * Requires authentication to prevent abuse
   */
  @Post('library/:id/use')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record pattern usage' })
  @ApiParam({ name: 'id', description: 'Pattern ID' })
  @ApiResponse({ status: 204, description: 'Usage recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Pattern not found' })
  async recordPatternUsage(@Param('id') id: string): Promise<void> {
    this.logger.info(
      `POST /api/v1/patterns/library/${id}/use - Recording usage`,
    );

    // First verify the pattern exists
    await this.patternsService.getPatternById(id);

    // Then increment usage
    await this.patternsService.incrementUsageCount(id);
  }
}
