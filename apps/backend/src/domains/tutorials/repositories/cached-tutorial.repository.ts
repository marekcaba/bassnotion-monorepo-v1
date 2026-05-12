import { Injectable } from '@nestjs/common';
import {
  ITutorialRepository,
  PaginationOptions,
  PaginatedResult,
} from './tutorial.repository.interface.js';
import { Tutorial } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CachedRepository } from '../../../infrastructure/cache/cached-repository.base.js';
import { TutorialRepository } from './tutorial.repository.js';

/**
 * Cached tutorial data structure (snake_case from database/cache).
 * This interface matches the output of Tutorial.toPersistence().
 */
interface CachedTutorialData {
  id: string;
  title: string;
  slug: string;
  description: string;
  youtube_id: string;
  duration: number;
  author_name: string;
  thumbnail_url?: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  is_active: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
  category?: string;
  // Draft & MIDI fields
  status?: string;
  last_modified?: string;
  auto_save_version?: number;
  drummer_midi_url?: string;
  bassline_midi_url?: string;
  harmony_midi_url?: string;
  deleted_at?: string;
  // Creator fields
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
  creator_subscriber_count?: number;
  // Modular block system
  blocks?: any[];
  // Act 1: Understand fields (legacy)
  understand_video_url?: string;
  understand_video_library_id?: string;
  understand_headline?: string;
  understand_questions?: any[];
  title_highlight_words?: string[];
  sidebar_title?: string;
}

/**
 * Cached decorator for TutorialRepository.
 *
 * Extends CachedRepository base class to provide consistent caching behavior
 * while implementing domain-specific methods like findBySlug, findByLevel, etc.
 *
 * Cache key patterns:
 * - tutorial:{id} - Single entity
 * - tutorial:slug:{slug} - By slug lookup
 * - tutorial:exists:{id} - Existence check
 * - tutorial:slug:exists:{slug} - Slug existence check
 * - tutorials:list:page:{n}:limit:{m} - Pagination
 * - tutorials:published:page:{n}:limit:{m} - Published pagination
 * - tutorials:level:{level} - By level
 * - tutorials:author:{name} - By author
 */
@Injectable()
export class CachedTutorialRepository
  extends CachedRepository<Tutorial, TutorialId, TutorialRepository>
  implements ITutorialRepository
{
  constructor(repository: TutorialRepository, cache: CacheService) {
    super(repository, cache, { ttl: 3600 }); // 1 hour default TTL
  }

  // ============================================================================
  // Domain-Specific Methods
  // ============================================================================

  /**
   * Find a tutorial by slug with caching.
   */
  async findBySlug(slug: TutorialSlug): Promise<Tutorial | null> {
    return this.findByAlternateKey(this.getSlugKey(slug), () =>
      this.repository.findBySlug(slug),
    );
  }

  /**
   * Find tutorials by level with caching.
   */
  async findByLevel(
    level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<Tutorial[]> {
    return this.findListByCriteria(this.getLevelKey(level), () =>
      this.repository.findByLevel(level),
    );
  }

  /**
   * Find published tutorials with pagination and caching.
   */
  async findPublished(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Tutorial>> {
    return this.findPaginatedByCriteria(this.getPublishedKey(options), () =>
      this.repository.findPublished(options),
    );
  }

  /**
   * Find tutorials by author with caching.
   */
  async findByAuthor(authorName: string): Promise<Tutorial[]> {
    return this.findListByCriteria(this.getAuthorKey(authorName), () =>
      this.repository.findByAuthor(authorName),
    );
  }

  /**
   * Check if a tutorial exists by slug with caching.
   */
  async existsBySlug(slug: TutorialSlug): Promise<boolean> {
    return this.existsByAlternateKey(this.getSlugExistsKey(slug), () =>
      this.repository.existsBySlug(slug),
    );
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected reconstitute(data: unknown): Tutorial {
    const d = data as CachedTutorialData;
    return Tutorial.reconstitute({
      id: TutorialId.create(d.id),
      title: d.title,
      slug: TutorialSlug.create(d.slug),
      description: d.description,
      youtubeId: d.youtube_id,
      duration: d.duration,
      authorName: d.author_name,
      thumbnailUrl: d.thumbnail_url,
      level: d.level,
      tags: d.tags || [],
      isActive: d.is_active,
      publishedAt: d.published_at ? new Date(d.published_at) : undefined,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
      category: d.category,
      // Draft & MIDI fields
      status: (d.status as 'draft' | 'published' | 'archived') || 'draft',
      lastModified: d.last_modified ? new Date(d.last_modified) : undefined,
      autoSaveVersion: d.auto_save_version || 0,
      drummerMidiUrl: d.drummer_midi_url,
      basslineMidiUrl: d.bassline_midi_url,
      harmonyMidiUrl: d.harmony_midi_url,
      deletedAt: d.deleted_at ? new Date(d.deleted_at) : undefined,
      // Creator fields
      creatorName: d.creator_name,
      creatorChannelUrl: d.creator_channel_url,
      creatorAvatarUrl: d.creator_avatar_url,
      creatorSubscriberCount: d.creator_subscriber_count,
      // Modular block system
      blocks: d.blocks || [],
      // Act 1: Understand fields
      understandVideoUrl: d.understand_video_url,
      understandVideoLibraryId: d.understand_video_library_id,
      understandHeadline: d.understand_headline,
      understandQuestions: d.understand_questions || [],
      titleHighlightWords: d.title_highlight_words || [],
      sidebarTitle: d.sidebar_title,
    });
  }

  protected toPersistence(entity: Tutorial): unknown {
    return entity.toPersistence();
  }

  protected getEntityKey(id: TutorialId): string {
    return `tutorial:${id.value}`;
  }

  protected getExistsKey(id: TutorialId): string {
    return `tutorial:exists:${id.value}`;
  }

  protected getPaginationKey(options: PaginationOptions): string {
    return `tutorials:list:page:${options.page}:limit:${options.limit}`;
  }

  protected getEntityId(entity: Tutorial): TutorialId {
    return entity.id;
  }

  protected async invalidateEntityCache(tutorial: Tutorial): Promise<void> {
    await Promise.all([
      this.cache.del(this.getEntityKey(tutorial.id)),
      this.cache.del(this.getSlugKey(tutorial.slug)),
      this.cache.del(this.getExistsKey(tutorial.id)),
      this.cache.del(this.getSlugExistsKey(tutorial.slug)),
      this.cache.del(this.getAuthorKey(tutorial.authorName)),
      this.cache.del(this.getLevelKey(tutorial.level)),
    ]);
  }

  protected async invalidateLists(): Promise<void> {
    await Promise.all([
      this.cache.del('tutorials:list:*'),
      this.cache.del('tutorials:published:*'),
    ]);
  }

  // ============================================================================
  // Domain-Specific Cache Keys
  // ============================================================================

  private getSlugKey(slug: TutorialSlug): string {
    return `tutorial:slug:${slug.value}`;
  }

  private getSlugExistsKey(slug: TutorialSlug): string {
    return `tutorial:slug:exists:${slug.value}`;
  }

  private getLevelKey(level: string): string {
    return `tutorials:level:${level}`;
  }

  private getAuthorKey(authorName: string): string {
    return `tutorials:author:${authorName.toLowerCase()}`;
  }

  private getPublishedKey(options: PaginationOptions): string {
    return `tutorials:published:page:${options.page}:limit:${options.limit}`;
  }
}
