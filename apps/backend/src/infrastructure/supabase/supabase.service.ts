import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly staticLogger = createStructuredLogger(SupabaseService.name);
  private supabaseClient!: SupabaseClient;

  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('🚀 SupabaseService constructor called', { correlationId });
  }

  onModuleInit() {
    try {
      // Use environment variables directly instead of ConfigService
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.warn('🔧 Supabase environment variables not found - creating mock client for tests', { correlationId });
        // Create a mock client for test environments
        this.supabaseClient = {} as SupabaseClient;
        return;
      }

      this.supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false } });

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.info('✅ SupabaseService initialized successfully', { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('❌ Error in SupabaseService initialization:', error as Error, { correlationId });
      // Create a mock client to prevent crashes
      this.supabaseClient = {} as SupabaseClient;
    }
  }

  getClient(): SupabaseClient {
    if (!this.supabaseClient) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.warn('⚠️ Supabase client not initialized - returning mock client', { correlationId });
      return {} as SupabaseClient;
    }
    return this.supabaseClient;
  }

  isReady(): boolean {
    return !!this.supabaseClient && Object.keys(this.supabaseClient).length > 0;
  }
}
