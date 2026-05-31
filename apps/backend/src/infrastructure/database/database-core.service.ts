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
      // docs explicitly recommend for Node < 22.
      //
      // Cast is `as any` rather than `as unknown as typeof globalThis.WebSocket`
      // because the `ws@^8.18` types differ from lib.dom's WebSocket in
      // `onerror` signature (Node's `ErrorEvent` carries `message`/
      // `filename` etc. that the browser DOM `Event` lacks). The dual
      // assertion compiles locally but Railway's stricter prod build
      // rejects it. Plain `as any` works everywhere and the
      // runtime behaviour is identical — Supabase only uses the
      // constructor signature.
      this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        realtime: { transport: WebSocket as any },
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
