import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import {
  Purchase,
  PurchaseStatus,
  CourseType,
} from '../types/billing.types.js';

interface PurchaseRow {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_payment_intent_id: string;
  stripe_checkout_session_id: string;
  course_type: CourseType | null;
  product_id: string | null;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PurchaseRepository {
  private readonly logger = new Logger(PurchaseRepository.name);
  private readonly TABLE_NAME = 'purchases';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRowToPurchase(row: PurchaseRow): Purchase {
    return {
      id: row.id,
      userId: row.user_id,
      stripeCustomerId: row.stripe_customer_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
      courseType: row.course_type,
      productId: row.product_id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findByUserId(userId: string): Promise<Purchase[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error finding purchases by user ID', error);
      throw error;
    }

    return (data as PurchaseRow[]).map(this.mapRowToPurchase);
  }

  async findByCheckoutSessionId(sessionId: string): Promise<Purchase | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Error finding purchase by session ID', error);
      throw error;
    }

    return this.mapRowToPurchase(data as PurchaseRow);
  }

  async findByPaymentIntentId(
    paymentIntentId: string,
  ): Promise<Purchase | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Error finding purchase by payment intent ID', error);
      throw error;
    }

    return this.mapRowToPurchase(data as PurchaseRow);
  }

  async create(
    purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Purchase> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .insert({
        user_id: purchase.userId,
        stripe_customer_id: purchase.stripeCustomerId,
        stripe_payment_intent_id: purchase.stripePaymentIntentId,
        stripe_checkout_session_id: purchase.stripeCheckoutSessionId,
        course_type: purchase.courseType,
        product_id: purchase.productId,
        amount: purchase.amount,
        currency: purchase.currency,
        status: purchase.status,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating purchase', error);
      throw error;
    }

    return this.mapRowToPurchase(data as PurchaseRow);
  }

  async updateStatus(
    stripePaymentIntentId: string,
    status: PurchaseStatus,
  ): Promise<Purchase> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating purchase status', error);
      throw error;
    }

    return this.mapRowToPurchase(data as PurchaseRow);
  }

  async getPurchasedCourses(userId: string): Promise<CourseType[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('course_type')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('course_type', 'is', null);

    if (error) {
      this.logger.error('Error getting purchased courses', error);
      throw error;
    }

    return (data as { course_type: CourseType | null }[])
      .map((row) => row.course_type)
      .filter((c): c is CourseType => c !== null);
  }

  async hasPurchasedCourse(
    userId: string,
    courseType: CourseType,
  ): Promise<boolean> {
    const purchasedCourses = await this.getPurchasedCourses(userId);
    return purchasedCourses.includes(courseType);
  }

  /**
   * Product-scoped ownership: the IDs of all products this user has completed a
   * purchase for. This is the primitive the entitlement resolver uses to gate
   * `product`-tier content (Groove Packs, Accelerator).
   */
  async getPurchasedProductIds(userId: string): Promise<string[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('product_id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('product_id', 'is', null);

    if (error) {
      this.logger.error('Error getting purchased product IDs', error);
      throw error;
    }

    return (data as { product_id: string }[]).map((row) => row.product_id);
  }

  /** Whether the user owns a specific product (completed purchase). */
  async hasPurchasedProduct(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();

    const { count, error } = await client
      .from(this.TABLE_NAME)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('status', 'completed');

    if (error) {
      this.logger.error('Error checking product ownership', error);
      throw error;
    }

    return (count ?? 0) > 0;
  }
}
