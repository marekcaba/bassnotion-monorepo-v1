import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@bassnotion/contracts';

/**
 * Core database service that provides singleton Supabase client
 * This service does not depend on request context and can be used in health checks
 */
@Injectable()
export class DatabaseCoreService implements OnModuleInit {
  private readonly logger = createStructuredLogger('DatabaseCoreService');
  private supabase!: SupabaseClient;

  onModuleInit() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      this.logger.debug('DatabaseCoreService initializing...', { correlationId: 'system' });

      // Use environment variables directly
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        this.logger.warn('Supabase environment variables not found', { 
          correlationId: 'system',
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseServiceRoleKey
        });
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      this.logger.info('DatabaseCoreService initialized successfully', { correlationId: 'system' });
    } catch (error) {
      this.logger.error('Error initializing DatabaseCoreService:', error as Error, { correlationId: 'system' });
      throw error;
    }
  }

  getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Database client not initialized');
    }
    return this.supabase;
  }

  isReady(): boolean {
    return !!this.supabase;
  }
}