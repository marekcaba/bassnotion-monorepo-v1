import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

export interface AcceleratorEnrollment {
  id: string;
  userId: string;
  productId: string;
  startedAt: Date;
}

interface EnrollmentRow {
  id: string;
  user_id: string;
  product_id: string;
  started_at: string;
}

/**
 * `accelerator_enrollments` — one row per purchase of an accelerator product.
 * `startedAt` is day 0 for the drip (product_contents.unlock_day). Created by
 * the webhook on a completed accelerator purchase; read by the entitlement
 * resolver to decide whether a given day's content has unlocked.
 */
@Injectable()
export class AcceleratorEnrollmentRepository {
  private readonly logger = new Logger(AcceleratorEnrollmentRepository.name);
  private readonly TABLE_NAME = 'accelerator_enrollments';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRow(row: EnrollmentRow): AcceleratorEnrollment {
    return {
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      startedAt: new Date(row.started_at),
    };
  }

  async findByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<AcceleratorEnrollment | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Error finding accelerator enrollment', error);
      throw error;
    }
    return this.mapRow(data as EnrollmentRow);
  }

  /** All of a user's accelerator enrollments (for batch drip resolution). */
  async findByUser(userId: string): Promise<AcceleratorEnrollment[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Error finding accelerator enrollments', error);
      throw error;
    }
    return (data as EnrollmentRow[]).map((r) => this.mapRow(r));
  }

  /** Idempotent: starts the drip clock on a completed accelerator purchase. */
  async enroll(
    userId: string,
    productId: string,
  ): Promise<AcceleratorEnrollment> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from(this.TABLE_NAME)
      .upsert(
        { user_id: userId, product_id: productId },
        { onConflict: 'user_id,product_id', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) {
      this.logger.error('Error enrolling in accelerator', error);
      throw error;
    }
    return this.mapRow(data as EnrollmentRow);
  }
}
