import { Injectable, Inject } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

interface TokenStatus {
  status: 'available' | 'consumed';
}

export interface TokenBalance {
  available: number;
  consumed: number;
  total: number;
}

@Injectable()
export class TokenService {
  private readonly staticLogger = createStructuredLogger(TokenService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    // Defensive check for DatabaseService
    if (!this.db) {
      logger.error(
        'DatabaseService is undefined in TokenService constructor!',
        new Error('DatabaseService is undefined'),
        { correlationId },
      );
    }
  }

  async getTokenBalance(userId: string): Promise<TokenBalance> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    // Defensive check for DatabaseService
    if (!this.db || !this.db.supabase) {
      logger.warn(
        'DatabaseService unavailable - returning zero token balance',
        { correlationId },
      );
      return {
        available: 0,
        consumed: 0,
        total: 0,
      };
    }

    const { data: tokens, error } = await this.db.supabase
      .from('tokens')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get token balance: ${error.message}`);
    }

    const available = tokens.filter(
      (t: TokenStatus) => t.status === 'available',
    ).length;
    const consumed = tokens.filter(
      (t: TokenStatus) => t.status === 'consumed',
    ).length;

    return {
      available,
      consumed,
      total: available + consumed,
    };
  }

  async consumeAllTokens(userId: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    // Defensive check for DatabaseService
    if (!this.db || !this.db.supabase) {
      logger.warn('DatabaseService unavailable - cannot consume tokens', {
        correlationId,
      });
      return;
    }

    const { error } = await this.db.supabase
      .from('tokens')
      .update({ status: 'consumed' })
      .eq('user_id', userId)
      .eq('status', 'available');

    if (error) {
      throw new Error(`Failed to consume tokens: ${error.message}`);
    }
  }
}
