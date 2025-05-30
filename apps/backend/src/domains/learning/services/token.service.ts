import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service.js';

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
  private readonly logger = new Logger(TokenService.name);

  constructor(private readonly db: DatabaseService) {
    // Defensive check for DatabaseService
    if (!this.db) {
      this.logger.error(
        'DatabaseService is undefined in TokenService constructor!',
      );
    }
  }

  async getTokenBalance(userId: string): Promise<TokenBalance> {
    // Defensive check for DatabaseService
    if (!this.db || !this.db.supabase) {
      this.logger.warn(
        'DatabaseService unavailable - returning zero token balance',
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
    // Defensive check for DatabaseService
    if (!this.db || !this.db.supabase) {
      this.logger.warn('DatabaseService unavailable - cannot consume tokens');
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
