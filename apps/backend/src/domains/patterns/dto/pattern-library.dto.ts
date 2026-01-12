/**
 * Pattern Library DTOs
 * Request/Response DTOs for the pattern library endpoints
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  PatternGenre,
  PatternDifficulty,
  PatternLibraryItem,
  PatternLibraryResponse,
  CreatePatternInput,
  DrumHit,
} from '@bassnotion/contracts';

/**
 * Query parameters for listing patterns
 */
export class GetPatternsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by genre',
    enum: [
      'rock',
      'pop',
      'jazz',
      'funk',
      'blues',
      'latin',
      'electronic',
      'metal',
      'reggae',
      'country',
      'rnb',
      'hiphop',
      'world',
      'other',
    ],
  })
  @IsOptional()
  @IsString()
  genre?: PatternGenre;

  @ApiPropertyOptional({
    description: 'Filter by difficulty',
    enum: ['beginner', 'intermediate', 'advanced'],
  })
  @IsOptional()
  @IsString()
  difficulty?: PatternDifficulty;

  @ApiPropertyOptional({ description: 'Filter by time signature numerator' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(16)
  timeSignatureNumerator?: number;

  @ApiPropertyOptional({ description: 'Filter by time signature denominator' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  timeSignatureDenominator?: number;

  @ApiPropertyOptional({ description: 'Filter by number of bars' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(32)
  bars?: number;

  @ApiPropertyOptional({
    description: 'Filter by BPM (patterns suitable for this BPM)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(300)
  bpm?: number;

  @ApiPropertyOptional({ description: 'Search by name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated)',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((t) => t.trim()) : value,
  )
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Only show featured patterns' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['name', 'createdAt', 'usageCount', 'difficulty'],
    default: 'name',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'difficulty';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Response DTO for pattern list
 */
export class PatternLibraryResponseDto implements PatternLibraryResponse {
  @ApiProperty({ description: 'List of patterns', isArray: true })
  patterns!: PatternLibraryItem[];

  @ApiProperty({ description: 'Total count of matching patterns' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  limit!: number;

  @ApiProperty({ description: 'Whether there are more pages' })
  hasMore!: boolean;
}

/**
 * Response DTO for single pattern
 */
export class PatternLibraryItemResponseDto {
  @ApiProperty({ description: 'Pattern details' })
  pattern!: PatternLibraryItem;
}

/**
 * Time signature DTO
 */
export class TimeSignatureDto {
  @ApiProperty({ description: 'Numerator (beats per measure)', example: 4 })
  @IsNumber()
  @Min(1)
  @Max(16)
  numerator!: number;

  @ApiProperty({ description: 'Denominator (beat value)', example: 4 })
  @IsNumber()
  denominator!: number;
}

/**
 * BPM range DTO
 */
export class BpmRangeDto {
  @ApiProperty({ description: 'Minimum BPM', example: 60 })
  @IsNumber()
  @Min(20)
  @Max(300)
  min!: number;

  @ApiProperty({ description: 'Maximum BPM', example: 120 })
  @IsNumber()
  @Min(20)
  @Max(300)
  max!: number;
}

/**
 * DTO for creating a new pattern in the library
 */
export class CreatePatternDto implements CreatePatternInput {
  @ApiProperty({ description: 'Pattern name', example: 'Funky Groove' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Pattern description',
    example: 'A syncopated funk groove with ghost notes',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Genre/style category',
    enum: [
      'rock',
      'pop',
      'jazz',
      'funk',
      'blues',
      'latin',
      'electronic',
      'metal',
      'reggae',
      'country',
      'rnb',
      'hiphop',
      'world',
      'other',
    ],
    example: 'funk',
  })
  @IsString()
  genre!: PatternGenre;

  @ApiProperty({
    description: 'Difficulty level',
    enum: ['beginner', 'intermediate', 'advanced'],
    example: 'intermediate',
  })
  @IsString()
  difficulty!: PatternDifficulty;

  @ApiProperty({ description: 'Number of bars/measures', example: 4 })
  @IsNumber()
  @Min(1)
  @Max(32)
  bars!: number;

  @ApiProperty({
    description: 'Time signature',
    type: TimeSignatureDto,
  })
  @Type(() => TimeSignatureDto)
  timeSignature!: TimeSignatureDto;

  @ApiProperty({
    description: 'Suggested BPM range',
    type: BpmRangeDto,
  })
  @Type(() => BpmRangeDto)
  bpmRange!: BpmRangeDto;

  @ApiProperty({
    description: 'Tags for searchability',
    type: [String],
    example: ['syncopated', 'ghost-notes', 'groove'],
  })
  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @ApiProperty({
    description: 'Drum hits array',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  drumHits!: DrumHit[];
}
