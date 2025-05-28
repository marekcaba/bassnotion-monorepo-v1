import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  public supabase!: SupabaseClient;
  private isInitialized = false;

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
        this.logger.error('ConfigService is undefined in onModuleInit');
        return;
      }

      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        this.logger.warn(
          'Missing Supabase configuration - running in limited mode',
          {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
          },
        );
        // Don't throw error - allow app to start without Supabase for health checks
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);

      try {
        // Test the connection but don't fail if it doesn't work
        const { error } = await this.supabase.auth.getSession();
        if (error) {
          this.logger.warn(
            'Supabase client test failed, but continuing:',
            error.message,
          );
        } else {
          this.logger.debug('Supabase client initialized successfully');
        }
        this.isInitialized = true;
      } catch (error) {
        this.logger.warn(
          'Error during Supabase client test, but continuing:',
          error,
        );
        // Don't throw - allow app to start
        this.isInitialized = true;
      }
    } catch (error) {
      this.logger.error(
        'Error in DatabaseService initialization, but continuing:',
        error,
      );
      // Don't throw - allow app to start for health checks
    }
  }

  isReady(): boolean {
    return this.isInitialized && !!this.supabase;
  }
}
