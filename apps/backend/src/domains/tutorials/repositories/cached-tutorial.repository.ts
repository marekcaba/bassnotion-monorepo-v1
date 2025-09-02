import { Injectable } from '@nestjs/common';
import {
  ITutorialRepository,
  PaginatedResult,
  PaginationOptions } from './tutorial.repository.interface.js';
import { Tutorial } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { TutorialRepository } from './tutorial.repository.js';

@Injectable()
export class CachedTutorialRepository implements ITutorialRepository {
  private readonly TTL = 3600; // 1 hour

  constructor(
    public readonly repository: TutorialRepository,
    private readonly cache: CacheService,
  ) {}

  async findById(id: TutorialId): Promise<Tutorial | null> {
    const key = this.getTutorialKey(id);

    return this.cache
      .wrap(
        key,
        async () => {
          const tutorial = await this.repository.findById(id);
          return tutorial ? tutorial.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findBySlug(slug: TutorialSlug): Promise<Tutorial | null> {
    const key = this.getSlugKey(slug);

    return this.cache
      .wrap(
        key,
        async () => {
          const tutorial = await this.repository.findBySlug(slug);
          return tutorial ? tutorial.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Tutorial>> {
    const key = this.getPaginationKey(options);

    return this.cache
      .wrap(
        key,
        async () => {
          const result = await this.repository.findAll(options);
          return {
            ...result,
            items: result.items.map((t) => t.toPersistence()) };
        },
        this.TTL / 2, // 30 minutes for list queries
      )
      .then((result) => ({
        ...result,
        items: result.items.map((data) => this.reconstitute(data)) }));
  }

  async findByLevel(
    level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<Tutorial[]> {
    const key = this.getLevelKey(level);

    return this.cache
      .wrap(
        key,
        async () => {
          const tutorials = await this.repository.findByLevel(level);
          return tutorials.map((t) => t.toPersistence());
        },
        this.TTL,
      )
      .then((items) => items.map((data) => this.reconstitute(data)));
  }

  async findPublished(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Tutorial>> {
    const key = this.getPublishedKey(options);

    return this.cache
      .wrap(
        key,
        async () => {
          const result = await this.repository.findPublished(options);
          return {
            ...result,
            items: result.items.map((t) => t.toPersistence()) };
        },
        this.TTL / 2, // 30 minutes for published content
      )
      .then((result) => ({
        ...result,
        items: result.items.map((data) => this.reconstitute(data)) }));
  }

  async search(query: string): Promise<Tutorial[]> {
    // Don't cache search results as they're too dynamic
    return this.repository.search(query);
  }

  async findByAuthor(authorName: string): Promise<Tutorial[]> {
    const key = this.getAuthorKey(authorName);

    return this.cache
      .wrap(
        key,
        async () => {
          const tutorials = await this.repository.findByAuthor(authorName);
          return tutorials.map((t) => t.toPersistence());
        },
        this.TTL,
      )
      .then((items) => items.map((data) => this.reconstitute(data)));
  }

  async save(tutorial: Tutorial): Promise<void> {
    await this.repository.save(tutorial);
    await this.invalidateCache(tutorial);
  }

  async update(tutorial: Tutorial): Promise<void> {
    await this.repository.update(tutorial);
    await this.invalidateCache(tutorial);
  }

  async delete(id: TutorialId): Promise<void> {
    // Get the tutorial first to invalidate slug cache
    const tutorial = await this.repository.findById(id);
    await this.repository.delete(id);

    if (tutorial) {
      await this.invalidateCache(tutorial);
    }
    await this.cache.del(this.getTutorialKey(id));
    await this.invalidateLists();
  }

  async exists(id: TutorialId): Promise<boolean> {
    const key = this.getExistsKey(id);

    return this.cache.wrap(key, () => this.repository.exists(id), this.TTL);
  }

  async existsBySlug(slug: TutorialSlug): Promise<boolean> {
    const key = this.getSlugExistsKey(slug);

    return this.cache.wrap(
      key,
      () => this.repository.existsBySlug(slug),
      this.TTL,
    );
  }

  async findByIds(ids: TutorialId[]): Promise<Tutorial[]> {
    if (ids.length === 0) return [];

    // For batch operations, we'll check cache for each individual item
    // and only fetch missing ones from the database
    const cachedResults: (Tutorial | null)[] = await Promise.all(
      ids.map((id) => this.findById(id)),
    );

    return cachedResults.filter(
      (tutorial): tutorial is Tutorial => tutorial !== null,
    );
  }

  async saveMany(tutorials: Tutorial[]): Promise<void> {
    await this.repository.saveMany(tutorials);

    // Invalidate cache for all saved tutorials
    await Promise.all(
      tutorials.map((tutorial) => this.invalidateCache(tutorial)),
    );
    await this.invalidateLists();
  }

  async updateMany(tutorials: Tutorial[]): Promise<void> {
    await this.repository.updateMany(tutorials);

    // Invalidate cache for all updated tutorials
    await Promise.all(
      tutorials.map((tutorial) => this.invalidateCache(tutorial)),
    );
    await this.invalidateLists();
  }

  async deleteMany(ids: TutorialId[]): Promise<void> {
    // Get tutorials first to invalidate slug caches
    const tutorials = await this.repository.findByIds(ids);
    await this.repository.deleteMany(ids);

    // Invalidate cache for all deleted tutorials
    await Promise.all([
      ...tutorials.map((tutorial) => this.invalidateCache(tutorial)),
      ...ids.map((id) => this.cache.del(this.getTutorialKey(id))),
    ]);
    await this.invalidateLists();
  }

  private async invalidateCache(tutorial: Tutorial): Promise<void> {
    await Promise.all([
      this.cache.del(this.getTutorialKey(tutorial.id)),
      this.cache.del(this.getSlugKey(tutorial.slug)),
      this.cache.del(this.getExistsKey(tutorial.id)),
      this.cache.del(this.getSlugExistsKey(tutorial.slug)),
      this.cache.del(this.getAuthorKey(tutorial.authorName)),
      this.cache.del(this.getLevelKey(tutorial.level)),
    ]);
  }

  private async invalidateLists(): Promise<void> {
    // Invalidate all paginated results
    // In production, you might want to track specific keys
    await Promise.all([
      this.cache.del('tutorials:list:*'),
      this.cache.del('tutorials:published:*'),
    ]);
  }

  private reconstitute(data: any): Tutorial {
    return Tutorial.reconstitute({
      id: TutorialId.create(data.id),
      title: data.title,
      slug: TutorialSlug.create(data.slug),
      description: data.description,
      youtubeId: data.youtube_id,
      duration: data.duration,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
      level: data.level,
      tags: data.tags || [],
      isActive: data.is_active,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at) });
  }

  private getTutorialKey(id: TutorialId): string {
    return `tutorial:${id.value}`;
  }

  private getSlugKey(slug: TutorialSlug): string {
    return `tutorial:slug:${slug.value}`;
  }

  private getExistsKey(id: TutorialId): string {
    return `tutorial:exists:${id.value}`;
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

  private getPaginationKey(options: PaginationOptions): string {
    return `tutorials:list:page:${options.page}:limit:${options.limit}`;
  }

  private getPublishedKey(options: PaginationOptions): string {
    return `tutorials:published:page:${options.page}:limit:${options.limit}`;
  }
}
