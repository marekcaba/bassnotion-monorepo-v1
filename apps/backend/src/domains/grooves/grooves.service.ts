/**
 * Grooves Service — the reusable groove library.
 *
 * A groove is authored once and referenced by tutorial/drill blocks. Modeled
 * on PatternsService: Supabase-backed list/get/create/update + a usage counter.
 * Reads use the service-role client (so admin listing sees inactive rows too);
 * RLS still protects the anon path on the public side.
 */

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  GrooveLibraryItem,
  GrooveLibraryResponse,
  CreateGrooveInput,
  UpdateGrooveInput,
} from '@bassnotion/contracts';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GroovesService {
  private readonly logger = createStructuredLogger(GroovesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /** List active grooves (optionally include inactive for admin). */
  async listGrooves(includeInactive = false): Promise<GrooveLibraryResponse> {
    const client = this.supabaseService.getClient();
    let query = client
      .from('groove_library')
      .select('*')
      .order('created_at', { ascending: false });
    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) {
      this.logger.error('Failed to list grooves', error);
      throw new InternalServerErrorException('Failed to list grooves');
    }
    const grooves = (data ?? []).map((r) => this.mapDbToGroove(r));
    return { grooves, total: grooves.length };
  }

  /** Fetch many grooves by id (used to resolve block references in one query). */
  async getGroovesByIds(ids: string[]): Promise<GrooveLibraryItem[]> {
    if (ids.length === 0) return [];
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('groove_library')
      .select('*')
      .in('id', ids);
    if (error) {
      this.logger.warn('Failed to fetch grooves by ids', {
        error: error.message,
      });
      return [];
    }
    return (data ?? []).map((r) => this.mapDbToGroove(r));
  }

  async getGrooveById(id: string): Promise<GrooveLibraryItem> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('groove_library')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      throw new NotFoundException(`Groove ${id} not found`);
    }
    return this.mapDbToGroove(data);
  }

  /**
   * Resolve what the bassline-url signer needs to gate a request: the groove's
   * own content tier (so a user who can't open the groove can't fetch its files)
   * and the requested variant's storage bucket/path + feature key. Reads the RAW
   * row (access_tier/product_id are backend-internal — not on the public
   * GrooveLibraryItem contract). Throws NotFound if the groove or variant is
   * missing. Returns a parsed storage ref (bucket + objectPath) from the variant
   * URL, since createSignedReadUrl signs by path, not URL.
   */
  async resolveBasslineGate(
    grooveId: string,
    variantId: string,
  ): Promise<{
    accessTier: 'free' | 'member' | 'product';
    productId: string | null;
    feature: string;
    bucket: string;
    objectPath: string;
  }> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('groove_library')
      .select('access_tier, product_id, stems')
      .eq('id', grooveId)
      .single();
    if (error || !data) {
      throw new NotFoundException(`Groove ${grooveId} not found`);
    }

    const stems = (data.stems ?? {}) as {
      bassVariants?: Array<{ id: string; url: string; feature?: string }>;
    };
    const variant = (stems.bassVariants ?? []).find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException(
        `Bassline variant ${variantId} not found on groove ${grooveId}`,
      );
    }

    const ref = this.parseStorageRef(variant.url);
    if (!ref) {
      throw new NotFoundException(
        `Bassline variant ${variantId} has an unparseable storage URL`,
      );
    }

    return {
      accessTier: (data.access_tier as 'free' | 'member' | 'product') ?? 'free',
      productId: (data.product_id as string | null) ?? null,
      feature: variant.feature ?? 'linesAndFills',
      bucket: ref.bucket,
      objectPath: ref.objectPath,
    };
  }

  /**
   * Extract { bucket, objectPath } from a Supabase storage URL of the form
   * `…/storage/v1/object/(public|sign)/<bucket>/<path>` (the `path` may carry a
   * `?token=…` querystring on a previously-signed URL, which we strip). Returns
   * null if it doesn't match.
   */
  private parseStorageRef(
    url: string,
  ): { bucket: string; objectPath: string } | null {
    const m = url.match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/,
    );
    if (!m) return null;
    return { bucket: m[1], objectPath: decodeURIComponent(m[2]) };
  }

  async createGroove(input: CreateGrooveInput): Promise<GrooveLibraryItem> {
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();
    const id = uuidv4();
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .concat('-', id.slice(0, 8));

    const record = {
      id,
      name: input.name,
      slug,
      subtitle: input.subtitle ?? '',
      original_bpm: input.originalBpm,
      original_key: input.originalKey,
      length_bars: input.lengthBars,
      stems: input.stems,
      chord_chart: input.chordChart ?? [],
      genre: input.genre ?? null,
      tags: input.tags ?? null,
      youtube_url: input.youtubeUrl ?? null,
      is_active: true,
      usage_count: 0,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await client
      .from('groove_library')
      .insert(record)
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to create groove', error);
      throw new InternalServerErrorException(
        `Failed to create groove: ${error.message}`,
      );
    }
    return this.mapDbToGroove(data);
  }

  async updateGroove(
    id: string,
    input: UpdateGrooveInput,
  ): Promise<GrooveLibraryItem> {
    const client = this.supabaseService.getClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
    if (input.originalBpm !== undefined) patch.original_bpm = input.originalBpm;
    if (input.originalKey !== undefined) patch.original_key = input.originalKey;
    if (input.lengthBars !== undefined) patch.length_bars = input.lengthBars;
    if (input.stems !== undefined) patch.stems = input.stems;
    if (input.chordChart !== undefined) patch.chord_chart = input.chordChart;
    if (input.genre !== undefined) patch.genre = input.genre;
    if (input.tags !== undefined) patch.tags = input.tags;
    if (input.youtubeUrl !== undefined) patch.youtube_url = input.youtubeUrl;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await client
      .from('groove_library')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) {
      throw new NotFoundException(`Groove ${id} not found or update failed`);
    }
    return this.mapDbToGroove(data);
  }

  private mapDbToGroove(r: Record<string, unknown>): GrooveLibraryItem {
    const stems = (r.stems ?? {}) as Record<string, unknown>;
    const bassVariants = Array.isArray(stems.bassVariants)
      ? (stems.bassVariants as GrooveLibraryItem['stems']['bassVariants'])
      : undefined;
    return {
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      subtitle: (r.subtitle as string) ?? '',
      originalBpm: r.original_bpm as number,
      originalKey: r.original_key as string,
      lengthBars: r.length_bars as number,
      stems: {
        bass: (stems.bass as string) ?? '',
        drums: (stems.drums as string) ?? '',
        harmony: (stems.harmony as string) ?? '',
        // Pass premium bassline variants through (was silently dropped before).
        ...(bassVariants ? { bassVariants } : {}),
      },
      chordChart: Array.isArray(r.chord_chart)
        ? (r.chord_chart as GrooveLibraryItem['chordChart'])
        : [],
      genre: (r.genre as string) ?? undefined,
      tags: (r.tags as string[]) ?? undefined,
      youtubeUrl: (r.youtube_url as string) ?? undefined,
      isActive: (r.is_active as boolean) ?? true,
      usageCount: (r.usage_count as number) ?? 0,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  }
}
