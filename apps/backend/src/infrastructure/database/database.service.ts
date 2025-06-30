import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  public supabase!: SupabaseClient;

  constructor() {
    this.logger.debug('DatabaseService constructor called');
  }

  onModuleInit() {
    try {
      this.logger.debug('DatabaseService initializing...');

      // Use environment variables directly instead of ConfigService
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        this.logger.warn(
          'Supabase environment variables not found - creating mock client for tests',
        );
        // Create a mock client for test environments
        this.supabase = {} as SupabaseClient;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      this.logger.log('DatabaseService initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing DatabaseService:', error);
      // Create fallback mock client
      this.supabase = {} as SupabaseClient;
    }
  }

  async initializeSupabaseClient(): Promise<void> {
    // Manual initialization method for test environments
    if (!this.supabase || Object.keys(this.supabase).length === 0) {
      this.onModuleInit();
    }
  }

  isReady(): boolean {
    return !!this.supabase && Object.keys(this.supabase).length > 0;
  }
}
