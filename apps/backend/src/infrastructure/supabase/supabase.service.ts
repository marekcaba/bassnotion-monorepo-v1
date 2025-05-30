import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient = {} as SupabaseClient;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.logger.debug('SupabaseService constructor called');
    this.logger.debug(`SupabaseService loaded from ${__filename}`);
    this.logger.debug(`ConfigService instance: ${!!configService}`);

    // Defensive check for ConfigService
    if (!this.configService) {
      this.logger.error(
        'ConfigService is undefined in SupabaseService constructor!',
      );
    } else {
      this.logger.debug(
        `SUPABASE_URL: ${configService.get<string>('SUPABASE_URL')}`,
      );
      this.logger.debug(
        `SUPABASE_ANON_KEY exists: ${!!configService.get<string>('SUPABASE_ANON_KEY')}`,
      );
    }
  }

  onModuleInit() {
    try {
      this.logger.debug('Initializing Supabase client');

      if (!this.configService) {
        this.logger.error(
          'ConfigService is undefined in onModuleInit - using environment variables directly',
        );
        const supabaseUrl = process.env['SUPABASE_URL'];
        const supabaseKey = process.env['SUPABASE_ANON_KEY'];

        if (!supabaseUrl || !supabaseKey) {
          this.logger.warn(
            'Missing Supabase configuration from env vars - running in limited mode',
            {
              hasUrl: !!supabaseUrl,
              hasKey: !!supabaseKey,
            },
          );
          return;
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.logger.debug('Supabase client initialized from env vars');
        this.isInitialized = true;
        return;
      }

      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

      if (!supabaseUrl || !supabaseKey) {
        this.logger.warn(
          'Missing Supabase configuration - running in limited mode',
          {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
          },
        );
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('Supabase client initialized');
      this.isInitialized = true;
    } catch (error) {
      this.logger.error(
        'Error in SupabaseService initialization, but continuing:',
        error,
      );
      // Don't throw - allow app to start
    }
  }

  getClient(): SupabaseClient {
    if (!this.isInitialized || !this.supabase) {
      this.logger.warn(
        'SupabaseService not properly initialized - returning empty client',
      );
      // Return a minimal client object to prevent crashes
      return {} as SupabaseClient;
    }
    return this.supabase;
  }

  isReady(): boolean {
    return this.isInitialized && !!this.supabase;
  }
}
