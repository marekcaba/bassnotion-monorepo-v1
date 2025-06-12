import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  public supabase!: SupabaseClient;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.logger.debug('DatabaseService constructor called');
    this.logger.debug('ConfigService state:', {
      isDefined: !!this.configService,
      hasSupabaseUrl: !!this.configService?.get('SUPABASE_URL'),
      hasSupabaseKey: !!this.configService?.get('SUPABASE_SERVICE_ROLE_KEY'),
    });

    if (!this.configService) {
      this.logger.error('ConfigService is undefined in constructor!');
    }
  }

  async onModuleInit() {
    try {
      this.logger.debug('Initializing Supabase client');
      this.logger.debug('ConfigService state:', {
        isDefined: !!this.configService,
        hasSupabaseUrl: !!this.configService?.get('SUPABASE_URL'),
        hasSupabaseKey: !!this.configService?.get('SUPABASE_SERVICE_ROLE_KEY'),
      });

      if (!this.configService) {
        this.logger.error(
          'ConfigService is undefined in onModuleInit - using environment variables directly',
        );
        const supabaseUrl = process.env['SUPABASE_URL'];
        const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

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

        this.logger.debug('Creating Supabase client from env vars');
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.logger.debug('Supabase client initialized from env vars');
        this.isInitialized = true;
        return;
      }

      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>(
        'SUPABASE_SERVICE_ROLE_KEY',
      );

      this.logger.debug('Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      });

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

      this.logger.debug('Creating Supabase client');
      this.supabase = createClient(supabaseUrl, supabaseKey);

      try {
        // Test the connection but don't fail if it doesn't work
        this.logger.debug('Testing Supabase connection');
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
    const ready = this.isInitialized && !!this.supabase;
    this.logger.debug('DatabaseService readiness check:', {
      isInitialized: this.isInitialized,
      hasSupabase: !!this.supabase,
      isReady: ready,
    });
    return ready;
  }
}
