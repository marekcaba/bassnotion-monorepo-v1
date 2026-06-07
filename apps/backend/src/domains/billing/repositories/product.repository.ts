import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import {
  Product,
  ProductType,
  CreateProductInput,
  UpdateProductInput,
} from '../types/billing.types.js';

interface ProductRow {
  id: string;
  slug: string;
  type: ProductType;
  name: string;
  description: string | null;
  stripe_price_id: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  tagline: string | null;
  cover_image_url: string | null;
  preview_groove_id: string | null;
  features: string[] | null;
  sort_order: number;
  badge: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Read access to the product catalog (`products` table). The catalog is the
 * source of truth that maps a Stripe price → an internal product, and that
 * gateable content references via `product_id`.
 */
@Injectable()
export class ProductRepository {
  private readonly logger = new Logger(ProductRepository.name);
  private readonly TABLE_NAME = 'products';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRowToProduct(row: ProductRow): Product {
    return {
      id: row.id,
      slug: row.slug,
      type: row.type,
      name: row.name,
      description: row.description ?? undefined,
      stripePriceId: row.stripe_price_id ?? undefined,
      priceInCents: row.price_cents,
      currency: row.currency,
      isActive: row.is_active,
      tagline: row.tagline ?? undefined,
      coverImageUrl: row.cover_image_url ?? undefined,
      previewGrooveId: row.preview_groove_id ?? undefined,
      features: row.features ?? [],
      sortOrder: row.sort_order ?? 0,
      badge: row.badge ?? undefined,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findAllActive(): Promise<Product[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });

    if (error) {
      this.logger.error('Error finding active products', error);
      throw error;
    }

    return (data as ProductRow[]).map((row) => this.mapRowToProduct(row));
  }

  async findById(id: string): Promise<Product | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding product by ID', error);
      throw error;
    }

    return this.mapRowToProduct(data as ProductRow);
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding product by slug', error);
      throw error;
    }

    return this.mapRowToProduct(data as ProductRow);
  }

  /**
   * Resolve a completed Stripe payment to the internal product it grants.
   * Used by the webhook to record a product-scoped purchase.
   */
  async findByStripePriceId(stripePriceId: string): Promise<Product | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('stripe_price_id', stripePriceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding product by Stripe price ID', error);
      throw error;
    }

    return this.mapRowToProduct(data as ProductRow);
  }

  // ---- Admin writes (PR-B) -------------------------------------------------

  /** Admin listing — includes inactive products. */
  async findAll(): Promise<Product[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });

    if (error) {
      this.logger.error('Error listing products', error);
      throw error;
    }
    return (data as ProductRow[]).map((row) => this.mapRowToProduct(row));
  }

  async create(input: CreateProductInput): Promise<Product> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .insert({
        slug: input.slug,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        stripe_price_id: input.stripePriceId ?? null,
        price_cents: input.priceInCents,
        currency: input.currency ?? 'usd',
        is_active: input.isActive ?? true,
        tagline: input.tagline ?? null,
        cover_image_url: input.coverImageUrl ?? null,
        preview_groove_id: input.previewGrooveId ?? null,
        features: input.features ?? [],
        sort_order: input.sortOrder ?? 0,
        badge: input.badge ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating product', error);
      throw error;
    }
    return this.mapRowToProduct(data as ProductRow);
  }

  async update(id: string, patch: UpdateProductInput): Promise<Product> {
    const client = this.supabaseService.getClient();

    // Build the snake_cased update record from only the provided fields.
    const record: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.slug !== undefined) record.slug = patch.slug;
    if (patch.type !== undefined) record.type = patch.type;
    if (patch.name !== undefined) record.name = patch.name;
    if (patch.description !== undefined) record.description = patch.description;
    if (patch.stripePriceId !== undefined)
      record.stripe_price_id = patch.stripePriceId;
    if (patch.priceInCents !== undefined) record.price_cents = patch.priceInCents;
    if (patch.currency !== undefined) record.currency = patch.currency;
    if (patch.isActive !== undefined) record.is_active = patch.isActive;
    if (patch.tagline !== undefined) record.tagline = patch.tagline;
    if (patch.coverImageUrl !== undefined)
      record.cover_image_url = patch.coverImageUrl;
    if (patch.previewGrooveId !== undefined)
      record.preview_groove_id = patch.previewGrooveId;
    if (patch.features !== undefined) record.features = patch.features;
    if (patch.sortOrder !== undefined) record.sort_order = patch.sortOrder;
    if (patch.badge !== undefined) record.badge = patch.badge;
    if (patch.metadata !== undefined) record.metadata = patch.metadata;

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .update(record)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating product', error);
      throw error;
    }
    return this.mapRowToProduct(data as ProductRow);
  }
}
