import { Injectable, Logger } from '@nestjs/common';
import { FeatureKey, isFeatureKey } from '@bassnotion/contracts';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

interface ProductFeatureRow {
  product_id: string;
  feature_key: string;
}

/**
 * The product→feature grant (`product_features` table). A product (or the
 * membership tier's product) grants a SET of feature keys; the entitlement
 * resolver unions the features across everything a user owns to answer
 * "may this user use feature X?".
 *
 * This is the FEATURE analogue of `ProductContentsRepository` (which maps
 * product→content). Unlike that repo's single-product `.eq` reads, the resolver
 * needs the features for MANY owned products at once, so this uses `.in(...)` —
 * which requires an explicit empty-array guard (the codebase convention).
 */
@Injectable()
export class ProductFeaturesRepository {
  private readonly logger = new Logger(ProductFeaturesRepository.name);
  private readonly TABLE_NAME = 'product_features';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * The union of feature keys granted by ANY of the given products. Returns a
   * deduped list of VALID FeatureKeys — a stray/unknown DB value (e.g. a feature
   * renamed in contracts but not migrated) is dropped rather than injected as a
   * bogus grant.
   */
  async featuresForProducts(productIds: string[]): Promise<FeatureKey[]> {
    // Empty IN would be a malformed query (and a free user has zero products).
    if (productIds.length === 0) return [];

    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('feature_key')
      .in('product_id', productIds);

    if (error) {
      this.logger.error('Error reading product features', error);
      throw error;
    }

    const seen = new Set<FeatureKey>();
    for (const row of (data ?? []) as Pick<ProductFeatureRow, 'feature_key'>[]) {
      if (isFeatureKey(row.feature_key)) {
        seen.add(row.feature_key);
      } else {
        this.logger.warn(
          `Unknown feature_key "${row.feature_key}" in product_features — ignoring`,
        );
      }
    }
    return [...seen];
  }

  // ---- Admin reads/writes (the feature-grant editor) ----------------------

  /** The features a single product grants (deduped, valid keys only). */
  async findByProductId(productId: string): Promise<FeatureKey[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('feature_key')
      .eq('product_id', productId);

    if (error) {
      this.logger.error('Error reading product features for product', error);
      throw error;
    }
    const seen = new Set<FeatureKey>();
    for (const row of (data ?? []) as Pick<ProductFeatureRow, 'feature_key'>[]) {
      if (isFeatureKey(row.feature_key)) seen.add(row.feature_key);
    }
    return [...seen];
  }

  /**
   * Replace a product's ENTIRE grant set (the checklist semantics): delete all
   * existing rows for the product, then insert the new set. `featureKeys` is
   * assumed pre-validated by the caller (controller checks FEATURE_KEYS), but we
   * dedupe defensively. Returns the stored set.
   */
  async setForProduct(
    productId: string,
    featureKeys: FeatureKey[],
  ): Promise<FeatureKey[]> {
    const client = this.supabaseService.getClient();
    const unique = [...new Set(featureKeys)];

    // Clear the product's current grants.
    const { error: delError } = await client
      .from(this.TABLE_NAME)
      .delete()
      .eq('product_id', productId);
    if (delError) {
      this.logger.error('Error clearing product features', delError);
      throw delError;
    }

    if (unique.length === 0) return [];

    const { error: insError } = await client.from(this.TABLE_NAME).insert(
      unique.map((feature_key) => ({ product_id: productId, feature_key })),
    );
    if (insError) {
      this.logger.error('Error inserting product features', insError);
      throw insError;
    }
    return unique;
  }
}
