import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { ContentAccessTier } from '../billing/types/billing.types.js';

export interface VideoAccess {
  bunnyVideoId: string;
  bunnyLibraryId: string;
  accessTier: ContentAccessTier;
  productId: string | null;
}

interface VideoRow {
  bunny_video_id: string;
  bunny_library_id: string;
  access_tier: ContentAccessTier;
  product_id: string | null;
  is_active: boolean;
}

/**
 * Reads the `videos` registry. Keyed by the Bunny video GUID. A video that is
 * absent (or inactive) is treated as FREE — gating is opt-in, so un-registered
 * videos keep playing exactly as before.
 */
@Injectable()
export class VideoRepository {
  private readonly logger = new Logger(VideoRepository.name);
  private readonly TABLE_NAME = 'videos';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Resolve the access requirement for a Bunny video. Returns null when the
   * video isn't registered/active — callers should treat null as FREE.
   */
  async findByBunnyVideoId(bunnyVideoId: string): Promise<VideoAccess | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('bunny_video_id, bunny_library_id, access_tier, product_id, is_active')
      .eq('bunny_video_id', bunnyVideoId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not registered → caller defaults to free
      this.logger.error('Error looking up video access', error);
      throw error;
    }

    const row = data as VideoRow;
    return {
      bunnyVideoId: row.bunny_video_id,
      bunnyLibraryId: row.bunny_library_id,
      accessTier: row.access_tier,
      productId: row.product_id,
    };
  }
}
