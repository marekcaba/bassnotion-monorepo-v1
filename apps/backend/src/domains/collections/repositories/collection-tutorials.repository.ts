import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { CollectionTutorial } from '../types/collections.types.js';

interface CollectionTutorialRow {
  id: string;
  collection_id: string;
  tutorial_id: string;
  sort_order: number;
  created_at: string;
}

/**
 * The folder↔tutorial assignment (`collection_tutorials`). Many-to-many: a
 * folder groups many tutorials; a tutorial may be in many folders. Replaces the
 * brittle tutorials.category string-match (which silently dropped tutorials).
 */
@Injectable()
export class CollectionTutorialsRepository {
  private readonly logger = new Logger(CollectionTutorialsRepository.name);
  private readonly TABLE_NAME = 'collection_tutorials';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRow(row: CollectionTutorialRow): CollectionTutorial {
    return {
      id: row.id,
      collectionId: row.collection_id,
      tutorialId: row.tutorial_id,
      sortOrder: row.sort_order ?? 0,
      createdAt: new Date(row.created_at),
    };
  }

  /** All assignments for one folder, ordered for display. */
  async findByCollectionId(collectionId: string): Promise<CollectionTutorial[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Error finding collection tutorials', error);
      throw error;
    }
    return (data as CollectionTutorialRow[]).map((r) => this.mapRow(r));
  }

  /**
   * All assignments across a set of folders in ONE query (the list endpoint
   * loads every visible folder's tutorials at once, avoiding N round-trips).
   */
  async findByCollectionIds(
    collectionIds: string[],
  ): Promise<CollectionTutorial[]> {
    if (collectionIds.length === 0) return [];
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .in('collection_id', collectionIds)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Error finding collection tutorials (batch)', error);
      throw error;
    }
    return (data as CollectionTutorialRow[]).map((r) => this.mapRow(r));
  }

  /** One assignment row by id (used by remove to confirm it exists). */
  async findById(id: string): Promise<CollectionTutorial | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding collection tutorial by id', error);
      throw error;
    }
    return this.mapRow(data as CollectionTutorialRow);
  }

  /**
   * Assign a tutorial to a folder. Idempotent against the UNIQUE
   * (collection_id, tutorial_id) constraint: a duplicate assignment upserts to
   * keep the latest sort_order rather than erroring.
   */
  async add(
    entry: Omit<CollectionTutorial, 'id' | 'createdAt'>,
  ): Promise<CollectionTutorial> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .upsert(
        {
          collection_id: entry.collectionId,
          tutorial_id: entry.tutorialId,
          sort_order: entry.sortOrder,
        },
        { onConflict: 'collection_id,tutorial_id' },
      )
      .select()
      .single();

    if (error) {
      this.logger.error('Error adding collection tutorial', error);
      throw error;
    }
    return this.mapRow(data as CollectionTutorialRow);
  }

  async remove(id: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client.from(this.TABLE_NAME).delete().eq('id', id);
    if (error) {
      this.logger.error('Error removing collection tutorial', error);
      throw error;
    }
  }
}
