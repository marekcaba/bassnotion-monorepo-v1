/**
 * Patterns Service
 * Handles pattern library business logic and data access
 */

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestContextService } from '../../shared/services/request-context.service.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  PatternLibraryItem,
  PatternLibraryFilter,
  PatternLibraryResponse,
  CreatePatternInput,
  PatternGenre,
  PatternDifficulty,
} from '@bassnotion/contracts';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PatternsService {
  private readonly logger = createStructuredLogger(PatternsService.name);

  constructor(
    private readonly requestContext: RequestContextService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Get patterns from the library with optional filtering
   * Fetches from Supabase database
   */
  async getPatterns(
    filter: PatternLibraryFilter,
  ): Promise<PatternLibraryResponse> {
    const correlationId = this.requestContext.getCorrelationId() || 'unknown';

    this.logger.info('Fetching patterns from library', {
      correlationId,
      filter: {
        genre: filter.genre,
        difficulty: filter.difficulty,
        search: filter.search,
        page: filter.page,
        limit: filter.limit,
      },
    });

    // Fetch patterns from Supabase
    let patterns = await this.fetchPatternsFromDatabase(correlationId);

    // Apply filters
    if (filter.genre) {
      patterns = patterns.filter((p) => p.genre === filter.genre);
    }

    if (filter.difficulty) {
      patterns = patterns.filter((p) => p.difficulty === filter.difficulty);
    }

    if (filter.timeSignatureNumerator !== undefined) {
      const numerator = Number(filter.timeSignatureNumerator);
      patterns = patterns.filter(
        (p) => p.timeSignature.numerator === numerator,
      );
    }

    if (filter.timeSignatureDenominator !== undefined) {
      const denominator = Number(filter.timeSignatureDenominator);
      patterns = patterns.filter(
        (p) => p.timeSignature.denominator === denominator,
      );
    }

    if (filter.bars !== undefined) {
      const bars = Number(filter.bars);
      patterns = patterns.filter((p) => p.bars === bars);
    }

    if (filter.bpm !== undefined) {
      const bpm = Number(filter.bpm);
      patterns = patterns.filter(
        (p) => bpm >= p.bpmRange.min && bpm <= p.bpmRange.max,
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      patterns = patterns.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.tags.some((t) => t.toLowerCase().includes(searchLower)),
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      patterns = patterns.filter((p) =>
        filter.tags!.some((tag) =>
          p.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
        ),
      );
    }

    if (filter.featured) {
      patterns = patterns.filter((p) => p.isFeatured);
    }

    // Apply sorting
    const sortBy = filter.sortBy || 'name';
    const sortOrder = filter.sortOrder || 'asc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    patterns.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * multiplier;
        case 'createdAt':
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            multiplier
          );
        case 'usageCount':
          return (a.usageCount - b.usageCount) * multiplier;
        case 'difficulty': {
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          return (
            (difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]) *
            multiplier
          );
        }
        default:
          return 0;
      }
    });

    // Apply pagination
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const startIndex = (page - 1) * limit;
    const total = patterns.length;
    const paginatedPatterns = patterns.slice(startIndex, startIndex + limit);

    this.logger.info('Patterns fetched successfully', {
      correlationId,
      total,
      returned: paginatedPatterns.length,
      page,
      limit,
    });

    return {
      patterns: paginatedPatterns,
      total,
      page,
      limit,
      hasMore: startIndex + limit < total,
    };
  }

  /**
   * Fetch all patterns from Supabase database
   */
  private async fetchPatternsFromDatabase(
    correlationId: string,
  ): Promise<PatternLibraryItem[]> {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('pattern_library')
        .select('*')
        .eq('is_active', true)
        .eq('type', 'drums')
        .not('drum_hits', 'is', null);

      if (error) {
        this.logger.warn('Failed to fetch patterns from database', {
          correlationId,
          errorCode: error.code,
          errorMessage: error.message,
        });
        return [];
      }

      return (data || []).map((record) => this.mapDbToPattern(record));
    } catch (err) {
      this.logger.warn('Error fetching patterns from database', {
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Get a single pattern by ID
   */
  async getPatternById(id: string): Promise<PatternLibraryItem> {
    const correlationId = this.requestContext.getCorrelationId() || 'unknown';

    this.logger.info('Fetching pattern by ID', {
      correlationId,
      patternId: id,
    });

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('pattern_library')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      this.logger.warn('Pattern not found', { correlationId, patternId: id });
      throw new NotFoundException(`Pattern with ID ${id} not found`);
    }

    this.logger.info('Pattern fetched successfully', {
      correlationId,
      patternId: id,
      patternName: data.name,
    });

    return this.mapDbToPattern(data);
  }

  /**
   * Increment usage count for a pattern
   */
  async incrementUsageCount(id: string): Promise<void> {
    const correlationId = this.requestContext.getCorrelationId() || 'unknown';

    this.logger.info('Incrementing pattern usage count', {
      correlationId,
      patternId: id,
    });

    const client = this.supabaseService.getClient();

    // Simple increment by fetching current value and updating
    const { data } = await client
      .from('pattern_library')
      .select('usage_count')
      .eq('id', id)
      .single();

    if (data) {
      await client
        .from('pattern_library')
        .update({ usage_count: (data.usage_count || 0) + 1 })
        .eq('id', id);
    }
  }

  /**
   * Create a new pattern in the library
   */
  async createPattern(input: CreatePatternInput): Promise<PatternLibraryItem> {
    const correlationId = this.requestContext.getCorrelationId() || 'unknown';

    this.logger.info('Creating new pattern in library', {
      correlationId,
      name: input.name,
      genre: input.genre,
      difficulty: input.difficulty,
      bars: input.bars,
      hitCount: input.drumHits.length,
    });

    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();
    const patternId = uuidv4();

    // Generate slug from name
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .concat('-', patternId.slice(0, 8));

    // Map input to database columns
    const dbRecord = {
      id: patternId,
      type: 'drums' as const,
      name: input.name,
      slug,
      genre: input.genre,
      time_signature: `${input.timeSignature.numerator}/${input.timeSignature.denominator}`,
      bars: input.bars,
      description: input.description,
      tags: input.tags,
      is_default: false,
      is_active: true,
      difficulty: input.difficulty,
      bpm_min: input.bpmRange.min,
      bpm_max: input.bpmRange.max,
      usage_count: 0,
      is_featured: false,
      drum_hits: input.drumHits,
      created_at: now,
      updated_at: now,
    };

    this.logger.info('Inserting pattern into Supabase', {
      correlationId,
      patternId,
      slug,
    });

    const { data, error } = await client
      .from('pattern_library')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create pattern in Supabase', error, {
        correlationId,
        patternId,
        errorCode: error.code,
        errorMessage: error.message,
      });
      throw new InternalServerErrorException(
        `Failed to create pattern: ${error.message}`,
      );
    }

    const newPattern = this.mapDbToPattern(data);

    this.logger.info('Pattern created successfully in Supabase', {
      correlationId,
      patternId: newPattern.id,
      patternName: newPattern.name,
    });

    return newPattern;
  }

  /**
   * Map database record to PatternLibraryItem format
   */
  private mapDbToPattern(
    dbRecord: Record<string, unknown>,
  ): PatternLibraryItem {
    const timeSignatureParts = (dbRecord.time_signature as string).split('/');
    return {
      id: dbRecord.id as string,
      name: dbRecord.name as string,
      description: (dbRecord.description as string) || '',
      genre: dbRecord.genre as PatternGenre,
      difficulty: dbRecord.difficulty as PatternDifficulty,
      bars: dbRecord.bars as number,
      timeSignature: {
        numerator: parseInt(timeSignatureParts[0], 10),
        denominator: parseInt(timeSignatureParts[1], 10),
      },
      bpmRange: {
        min: dbRecord.bpm_min as number,
        max: dbRecord.bpm_max as number,
      },
      tags: (dbRecord.tags as string[]) || [],
      createdAt: dbRecord.created_at as string,
      updatedAt: dbRecord.updated_at as string,
      isFeatured: (dbRecord.is_featured as boolean) || false,
      usageCount: (dbRecord.usage_count as number) || 0,
      drumHits: dbRecord.drum_hits as PatternLibraryItem['drumHits'],
    };
  }
}
