import { Injectable, Logger } from '@nestjs/common';
import {
  FOUNDER_CARD_CONFIG_DEFAULTS,
  FounderCardConfig,
  founderCardConfigSchema,
} from '@bassnotion/contracts';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

const TABLE_NAME = 'founder_card_config';
const SINGLETON_ID = 'default';

interface FounderCardConfigRow {
  id: string;
  data: unknown;
  updated_at: string;
  updated_by: string | null;
}

@Injectable()
export class FounderCardConfigRepository {
  private readonly logger = new Logger(FounderCardConfigRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Load the singleton config row. If the row is missing (e.g. migration
   * hasn't run yet on this environment) OR the stored JSON fails Zod
   * validation (schema drifted forward, manual SQL edit went wrong), fall
   * back to the in-code defaults so the public page never breaks.
   */
  async loadConfig(): Promise<FounderCardConfig> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('id', SINGLETON_ID)
      .maybeSingle<FounderCardConfigRow>();

    if (error) {
      this.logger.error('Failed to load founder_card_config', {
        code: error.code,
        message: error.message,
      });
      return FOUNDER_CARD_CONFIG_DEFAULTS;
    }

    if (!data) {
      this.logger.warn(
        'founder_card_config row missing — falling back to defaults',
      );
      return FOUNDER_CARD_CONFIG_DEFAULTS;
    }

    const parsed = founderCardConfigSchema.safeParse(data.data);
    if (!parsed.success) {
      this.logger.warn(
        'founder_card_config row failed schema validation — using defaults',
        { issues: parsed.error.flatten() },
      );
      return FOUNDER_CARD_CONFIG_DEFAULTS;
    }

    return parsed.data;
  }

  /**
   * Upsert the singleton config row. Caller is expected to have already
   * validated `config` via founderCardConfigSchema, but we re-parse here
   * defensively so a bad caller can't poison the DB.
   */
  async saveConfig(
    config: FounderCardConfig,
    updatedBy: string | null,
  ): Promise<FounderCardConfig> {
    const validated = founderCardConfigSchema.parse(config);
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(TABLE_NAME)
      .upsert(
        {
          id: SINGLETON_ID,
          data: validated,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        },
        { onConflict: 'id' },
      )
      .select()
      .single<FounderCardConfigRow>();

    if (error) {
      this.logger.error('Failed to save founder_card_config', {
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    const parsed = founderCardConfigSchema.safeParse(data.data);
    if (!parsed.success) {
      this.logger.error('Saved row failed re-parse', {
        issues: parsed.error.flatten(),
      });
      throw new Error('founder_card_config persisted but failed re-parse');
    }

    return parsed.data;
  }
}
