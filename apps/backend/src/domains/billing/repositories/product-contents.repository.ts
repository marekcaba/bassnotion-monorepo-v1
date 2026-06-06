import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import {
  ProductContent,
  ProductContentType,
} from '../types/billing.types.js';

interface ProductContentRow {
  id: string;
  product_id: string;
  content_type: ProductContentType;
  content_id: string;
  unlock_day: number;
  sort_order: number;
  note: string | null;
  created_at: string;
}

/**
 * The product↔content bundle (`product_contents` table). A product bundles many
 * content items; an item can be in many products. This is the authoritative
 * "what's in this pack" list, and the source the entitlement resolver uses to
 * answer "does the user own ANY product that bundles this item?".
 */
@Injectable()
export class ProductContentsRepository {
  private readonly logger = new Logger(ProductContentsRepository.name);
  private readonly TABLE_NAME = 'product_contents';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRow(row: ProductContentRow): ProductContent {
    return {
      id: row.id,
      productId: row.product_id,
      contentType: row.content_type,
      contentId: row.content_id,
      unlockDay: row.unlock_day,
      sortOrder: row.sort_order,
      note: row.note ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /** All content bundled in a product, ordered for display. */
  async findByProductId(productId: string): Promise<ProductContent[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Error finding product contents', error);
      throw error;
    }
    return (data as ProductContentRow[]).map((r) => this.mapRow(r));
  }

  /**
   * The entitlement primitive: every (product_id, unlock_day) pairing that
   * bundles a given content item. The resolver checks whether the user owns any
   * of these products (and, for accelerators, whether unlock_day is reached).
   */
  async findByContent(
    contentType: ProductContentType,
    contentId: string,
  ): Promise<ProductContent[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('content_type', contentType)
      .eq('content_id', contentId);

    if (error) {
      this.logger.error('Error finding products for content', error);
      throw error;
    }
    return (data as ProductContentRow[]).map((r) => this.mapRow(r));
  }

  // ---- Admin writes (PR-B uses these) -------------------------------------

  async add(
    entry: Omit<ProductContent, 'id' | 'createdAt'>,
  ): Promise<ProductContent> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .insert({
        product_id: entry.productId,
        content_type: entry.contentType,
        content_id: entry.contentId,
        unlock_day: entry.unlockDay,
        sort_order: entry.sortOrder,
        note: entry.note ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error adding product content', error);
      throw error;
    }
    return this.mapRow(data as ProductContentRow);
  }

  async remove(id: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client.from(this.TABLE_NAME).delete().eq('id', id);
    if (error) {
      this.logger.error('Error removing product content', error);
      throw error;
    }
  }
}
