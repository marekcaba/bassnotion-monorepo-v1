import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  public supabase!: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    if (!configService) {
      this.logger.error('ConfigService not injected properly');
      throw new Error('ConfigService not injected properly');
    }
    this.logger.debug('DatabaseService constructor called');
  }

  async onModuleInit() {
    try {
      this.logger.debug('Initializing Supabase client');

      if (!this.configService) {
        throw new Error('ConfigService is undefined in onModuleInit');
      }

      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        this.logger.error('Missing Supabase configuration', {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        });
        throw new Error('Missing Supabase configuration. Please check your .env file');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);

      try {
        const { error } = await this.supabase.auth.getSession();
        if (error) {
          this.logger.error('Failed to initialize Supabase client:', error);
          throw error;
        }
        this.logger.debug('Supabase client initialized successfully');
      } catch (error) {
        this.logger.error('Error during Supabase client initialization:', error);
        throw error;
      }
    } catch (error) {
      this.logger.error('Fatal error in DatabaseService initialization:', error);
      throw error;
    }
  }
}
