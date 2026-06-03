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
    const stems = (r.stems ?? {}) as Record<string, string>;
    return {
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      subtitle: (r.subtitle as string) ?? '',
      originalBpm: r.original_bpm as number,
      originalKey: r.original_key as string,
      lengthBars: r.length_bars as number,
      stems: {
        bass: stems.bass ?? '',
        drums: stems.drums ?? '',
        harmony: stems.harmony ?? '',
      },
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
