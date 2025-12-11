import { Injectable, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly staticLogger = createStructuredLogger(DatabaseService.name);
  public supabase!: SupabaseClient;

  constructor(
    @Optional()
    @Inject(RequestContextService)
    private readonly requestContext?: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId() || 'system';
    logger.debug('DatabaseService constructor called', { correlationId });
  }

  private initializeClient(): void {
    try {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId() || 'system';
      logger.debug('DatabaseService initializing...', { correlationId });

      // Use environment variables directly instead of ConfigService
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      logger.info('Checking Supabase environment variables', {
        hasSupabaseUrl: !!supabaseUrl,
        supabaseUrlLength: supabaseUrl?.length,
        hasServiceRoleKey: !!supabaseServiceRoleKey,
        serviceRoleKeyLength: supabaseServiceRoleKey?.length,
        correlationId,
      });

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        logger.warn(
          'Supabase environment variables not found - creating mock client for tests',
          { correlationId },
        );
        // Create a mock client for test environments
        this.supabase = {} as SupabaseClient;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      logger.info('DatabaseService initialized successfully', {
        correlationId,
      });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId() || 'system';
      logger.error('Error initializing DatabaseService:', error as Error, {
        correlationId,
      });
      // Create fallback mock client
      this.supabase = {} as SupabaseClient;
    }
  }

  onModuleInit() {
    this.initializeClient();
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

  getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Database client not initialized');
    }
    return this.supabase;
  }
}
