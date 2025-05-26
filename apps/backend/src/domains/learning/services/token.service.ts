import { Injectable } from '@nestjs/common';

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
  constructor(private readonly db: DatabaseService) {}

  async getTokenBalance(userId: string): Promise<TokenBalance> {
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
