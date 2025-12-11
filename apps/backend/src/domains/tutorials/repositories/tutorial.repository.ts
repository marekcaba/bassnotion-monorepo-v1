import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ITutorialRepository,
  PaginatedResult,
  PaginationOptions,
} from './tutorial.repository.interface.js';
import { Tutorial } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

interface TutorialRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  youtube_id: string;
  duration: number;
  author_name: string;
  thumbnail_url?: string;
  level: string;
  tags: string[];
  is_active: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // New fields for draft and MIDI support
  status?: string;
  last_modified?: string;
  auto_save_version?: number;
  drummer_midi_url?: string;
  bassline_midi_url?: string;
  harmony_midi_url?: string;
  deleted_at?: string;
  // Creator fields for YouTube attribution
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
  creator_subscriber_count?: number;
}

@Injectable()
export class TutorialRepository implements ITutorialRepository {
  private readonly staticLogger = createStructuredLogger(
    TutorialRepository.name,
  );
  private supabaseClient?: SupabaseClient;

  constructor(
    private readonly supabaseService: any, // Will be SupabaseService
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  private get supabase(): SupabaseClient {
    if (!this.supabaseClient) {
      this.supabaseClient = this.supabaseService.getClient();
    }
    return this.supabaseClient!;
  }

  async findById(id: TutorialId): Promise<Tutorial | null> {
    try {
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('*')
        .eq('id', id.value)
        .single();

      if (error || !data) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.debug(`Tutorial not found with id: ${id.value}`, {
          correlationId,
        });
        return null;
      }

      return this.mapToEntity(data as TutorialRecord);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error finding tutorial by id ${id.value}:`,
        error as Error,
        { correlationId },
      );
      throw new Error(
        `Failed to find tutorial: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findBySlug(slug: TutorialSlug): Promise<Tutorial | null> {
    try {
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('*')
        .eq('slug', slug.value)
        .single();

      if (error || !data) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.debug(`Tutorial not found with slug: ${slug.value}`, {
          correlationId,
        });
        return null;
      }

      return this.mapToEntity(data as TutorialRecord);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error finding tutorial by slug ${slug.value}:`,
        error as Error,
        { correlationId },
      );
      throw new Error(
        `Failed to find tutorial: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Tutorial>> {
    try {
      const offset = (options.page - 1) * options.limit;

      const { data, error, count } = await this.supabase
        .from('tutorials')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + options.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch tutorials: ${error.message}`);
      }

      const tutorials = (data || []).map((record) =>
        this.mapToEntity(record as TutorialRecord),
      );

      return {
        items: tutorials,
        total: count || 0,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching all tutorials:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  async findByLevel(
    level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<Tutorial[]> {
    try {
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('*')
        .eq('level', level)
        .order('title', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch tutorials by level: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as TutorialRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error fetching tutorials by level ${level}:`,
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  async findPublished(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Tutorial>> {
    try {
      const offset = (options.page - 1) * options.limit;

      const { data, error, count } = await this.supabase
        .from('tutorials')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .range(offset, offset + options.limit - 1);

      if (error) {
        throw new Error(
          `Failed to fetch published tutorials: ${error.message}`,
        );
      }

      const tutorials = (data || []).map((record) =>
        this.mapToEntity(record as TutorialRecord),
      );

      return {
        items: tutorials,
        total: count || 0,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching published tutorials:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  async search(query: string): Promise<Tutorial[]> {
    try {
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('*')
        .or(
          `title.ilike.%${query}%,description.ilike.%${query}%,author_name.ilike.%${query}%`,
        )
        .order('title', { ascending: true });

      if (error) {
        throw new Error(`Failed to search tutorials: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as TutorialRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error searching tutorials with query "${query}":`,
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  async findByAuthor(authorName: string): Promise<Tutorial[]> {
    try {
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('*')
        .eq('author_name', authorName)
        .order('published_at', { ascending: false });

      if (error) {
        throw new Error(
          `Failed to fetch tutorials by author: ${error.message}`,
        );
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as TutorialRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error fetching tutorials by author ${authorName}:`,
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  async save(tutorial: Tutorial): Promise<void> {
    try {
      const data = tutorial.toPersistence();
      const { error } = await this.supabase.from('tutorials').insert(data);

      if (error) {
        throw new Error(`Failed to save tutorial: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully saved tutorial: ${tutorial.id.value}`, {
        correlationId,
      });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving tutorial:', error as Error, { correlationId });
      throw error;
    }
  }

  async update(tutorial: Tutorial): Promise<void> {
    try {
      const data = tutorial.toPersistence();
      const { error } = await this.supabase
        .from('tutorials')
        .update(data)
        .eq('id', tutorial.id.value);

      if (error) {
        throw new Error(`Failed to update tutorial: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully updated tutorial: ${tutorial.id.value}`, {
        correlationId,
      });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error updating tutorial ${tutorial.id.value}:`,
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  async delete(id: TutorialId): Promise<void> {
    try {
      // Soft delete by setting is_active to false
      const { error } = await this.supabase
        .from('tutorials')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id.value);

      if (error) {
        throw new Error(`Failed to delete tutorial: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully deleted tutorial: ${id.value}`, {
        correlationId,
      });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error deleting tutorial ${id.value}:`, error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  async exists(id: TutorialId): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('tutorials')
        .select('id', { count: 'exact', head: true })
        .eq('id', id.value);

      if (error) {
        throw new Error(`Failed to check tutorial existence: ${error.message}`);
      }

      return (count ?? 0) > 0;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error checking existence of tutorial ${id.value}:`,
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  async existsBySlug(slug: TutorialSlug): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('tutorials')
        .select('id', { count: 'exact', head: true })
        .eq('slug', slug.value);

      if (error) {
        throw new Error(
          `Failed to check tutorial existence by slug: ${error.message}`,
        );
      }

      return (count ?? 0) > 0;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error checking existence of tutorial by slug ${slug.value}:`,
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  async findByIds(ids: TutorialId[]): Promise<Tutorial[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const idValues = ids.map((id) => id.value);
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('*')
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to fetch tutorials by ids: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as TutorialRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching tutorials by ids:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  async saveMany(tutorials: Tutorial[]): Promise<void> {
    if (tutorials.length === 0) return;

    try {
      const data = tutorials.map((tutorial) => tutorial.toPersistence());
      const { error } = await this.supabase.from('tutorials').insert(data);

      if (error) {
        throw new Error(`Failed to save tutorials batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully saved ${tutorials.length} tutorials in batch`,
        { correlationId },
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving tutorials batch:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  async updateMany(tutorials: Tutorial[]): Promise<void> {
    if (tutorials.length === 0) return;

    try {
      // Supabase doesn't support bulk updates natively, so we use a transaction-like approach
      const updates = tutorials.map((tutorial) =>
        this.supabase
          .from('tutorials')
          .update(tutorial.toPersistence())
          .eq('id', tutorial.id.value),
      );

      const results = await Promise.all(updates);

      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        throw new Error(
          `Failed to update tutorials batch: ${errors.map((e) => e.error?.message).join(', ')}`,
        );
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully updated ${tutorials.length} tutorials in batch`,
        { correlationId },
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error updating tutorials batch:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  async deleteMany(ids: TutorialId[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const idValues = ids.map((id) => id.value);
      const { error } = await this.supabase
        .from('tutorials')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to delete tutorials batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully deleted ${ids.length} tutorials in batch`, {
        correlationId,
      });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error deleting tutorials batch:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  private mapToEntity(record: TutorialRecord): Tutorial {
    return Tutorial.reconstitute({
      id: TutorialId.create(record.id),
      title: record.title,
      slug: TutorialSlug.create(record.slug),
      description: record.description,
      youtubeId: record.youtube_id,
      duration: record.duration,
      authorName: record.author_name,
      thumbnailUrl: record.thumbnail_url,
      level: record.level as 'beginner' | 'intermediate' | 'advanced',
      tags: record.tags || [],
      isActive: record.is_active,
      publishedAt: record.published_at
        ? new Date(record.published_at)
        : undefined,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      // New fields for draft and MIDI support
      status: (record.status as 'draft' | 'published' | 'archived') || 'draft',
      lastModified: record.last_modified
        ? new Date(record.last_modified)
        : undefined,
      autoSaveVersion: record.auto_save_version || 0,
      drummerMidiUrl: record.drummer_midi_url,
      basslineMidiUrl: record.bassline_midi_url,
      harmonyMidiUrl: record.harmony_midi_url,
      deletedAt: record.deleted_at ? new Date(record.deleted_at) : undefined,
      // Creator fields for YouTube attribution
      creatorName: record.creator_name,
      creatorChannelUrl: record.creator_channel_url,
      creatorAvatarUrl: record.creator_avatar_url,
      creatorSubscriberCount: record.creator_subscriber_count,
    });
  }
}
