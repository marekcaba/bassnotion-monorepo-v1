import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
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
      this.logger.debug('DatabaseCoreService initializing...', {
        correlationId: 'system',
      });

      // Use environment variables directly
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        this.logger.warn('Supabase environment variables not found', {
          correlationId: 'system',
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseServiceRoleKey,
        });
        return;
      }

      // Node 20 doesn't ship native WebSocket, but `@supabase/realtime-js`
      // (transitive dep of supabase-js) requires one at constructor time
      // even when realtime features aren't used. Without this transport
      // override the whole client throws "Node.js 20 detected without
      // native WebSocket support" on `createClient`, crashing the entire
      // Nest app on startup. We pass the `ws` package which the Supabase
      // docs explicitly recommend for Node < 22. The cast is unfortunate
      // but necessary — `ws.WebSocket` is structurally a `WebSocket`
      // constructor but TypeScript's lib.dom signatures differ slightly
      // around `binaryType` literal types.
      this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        realtime: {
          transport: WebSocket as unknown as typeof globalThis.WebSocket,
        },
      });
      this.logger.info('DatabaseCoreService initialized successfully', {
        correlationId: 'system',
      });
    } catch (error) {
      this.logger.error(
        'Error initializing DatabaseCoreService:',
        error as Error,
        { correlationId: 'system' },
      );
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
