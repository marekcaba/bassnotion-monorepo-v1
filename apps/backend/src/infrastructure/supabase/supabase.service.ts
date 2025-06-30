import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient!: SupabaseClient;

  constructor() {
    this.logger.debug('🚀 SupabaseService constructor called');
  }

  onModuleInit() {
    try {
      // Use environment variables directly instead of ConfigService
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        this.logger.warn(
          '🔧 Supabase environment variables not found - creating mock client for tests',
        );
        // Create a mock client for test environments
        this.supabaseClient = {} as SupabaseClient;
        return;
      }

      this.supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      this.logger.log('✅ SupabaseService initialized successfully');
    } catch (error) {
      this.logger.error('❌ Error in SupabaseService initialization:', error);
      // Create a mock client to prevent crashes
      this.supabaseClient = {} as SupabaseClient;
    }
  }

  getClient(): SupabaseClient {
    if (!this.supabaseClient) {
      this.logger.warn(
        '⚠️ Supabase client not initialized - returning mock client',
      );
      return {} as SupabaseClient;
    }
    return this.supabaseClient;
  }

  isReady(): boolean {
    return !!this.supabaseClient && Object.keys(this.supabaseClient).length > 0;
  }
}
