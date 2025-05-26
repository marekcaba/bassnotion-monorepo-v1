import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient = {} as SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.logger.debug('SupabaseService constructor called');
    this.logger.debug(`SupabaseService loaded from ${__filename}`);
    this.logger.debug(`ConfigService instance: ${!!configService}`);
    if (configService) {
      this.logger.debug(
        `SUPABASE_URL: ${configService.get<string>('SUPABASE_URL')}`,
      );
      this.logger.debug(
        `SUPABASE_ANON_KEY exists: ${!!configService.get<string>('SUPABASE_ANON_KEY')}`,
      );
    }
  }

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
