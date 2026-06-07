import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import {
  Collection,
  CollectionAccessTier,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../types/collections.types.js';

interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  access_tier: CollectionAccessTier;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Read/write access to the `collections` table (DB-driven sidebar folders).
 * Uses the service-role client (bypasses RLS); the AdminGuard on the admin
 * controller is the real boundary for writes.
 */
@Injectable()
export class CollectionsRepository {
  private readonly logger = new Logger(CollectionsRepository.name);
  private readonly TABLE_NAME = 'collections';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRow(row: CollectionRow): Collection {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description ?? undefined,
      accessTier: row.access_tier,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /** Active folders only, in sidebar display order (public read path). */
  async findAllActive(): Promise<Collection[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Error finding active collections', error);
      throw error;
    }
    return (data as CollectionRow[]).map((r) => this.mapRow(r));
  }

  /** ALL folders incl. inactive (admin table). */
  async findAll(): Promise<Collection[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Error listing collections', error);
      throw error;
    }
    return (data as CollectionRow[]).map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<Collection | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding collection by id', error);
      throw error;
    }
    return this.mapRow(data as CollectionRow);
  }

  async findBySlug(slug: string): Promise<Collection | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding collection by slug', error);
      throw error;
    }
    return this.mapRow(data as CollectionRow);
  }

  async create(input: CreateCollectionInput): Promise<Collection> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .insert({
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        access_tier: input.accessTier ?? 'free',
        sort_order: input.sortOrder ?? 0,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating collection', error);
      throw error;
    }
    return this.mapRow(data as CollectionRow);
  }

  async update(id: string, patch: UpdateCollectionInput): Promise<Collection> {
    const client = this.supabaseService.getClient();

    // Snake-case only the provided fields; updated_at is bumped by the trigger
    // but we set it too so the returned row reflects the write immediately.
    const record: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.slug !== undefined) record.slug = patch.slug;
    if (patch.title !== undefined) record.title = patch.title;
    if (patch.description !== undefined) record.description = patch.description;
    if (patch.accessTier !== undefined) record.access_tier = patch.accessTier;
    if (patch.sortOrder !== undefined) record.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) record.is_active = patch.isActive;

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .update(record)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating collection', error);
      throw error;
    }
    return this.mapRow(data as CollectionRow);
  }

  /** Hard-delete a folder. collection_tutorials rows cascade (FK ON DELETE CASCADE). */
  async delete(id: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from(this.TABLE_NAME)
      .delete()
      .eq('id', id);
    if (error) {
      this.logger.error('Error deleting collection', error);
      throw error;
    }
  }
}
