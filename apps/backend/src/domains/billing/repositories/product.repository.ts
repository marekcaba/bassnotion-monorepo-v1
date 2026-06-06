import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { Product, ProductType } from '../types/billing.types.js';

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
}
