import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { StripeService } from './services/stripe.service.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import type {
  CreateCheckoutSessionDto,
  CheckoutSessionResponse,
  CustomerPortalResponse,
  UserAccessStatus,
} from './types/billing.types.js';
import {
  COURSE_PRODUCTS,
  SUBSCRIPTION_PRODUCT,
} from './types/billing.types.js';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

@Controller('api/v1/billing')
export class BillingController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly purchaseRepository: PurchaseRepository,
  ) {}

  /**
   * Get available products (courses and subscription)
   * Public endpoint for pricing page
   */
  @Get('products')
  @HttpCode(HttpStatus.OK)
  getProducts() {
    return {
      courses: Object.values(COURSE_PRODUCTS).map((course) => ({
        type: course.type,
        name: course.name,
        description: course.description,
        price: course.priceInCents / 100,
        currency: 'usd',
        features: course.features,
      })),
      subscription: {
        plan: SUBSCRIPTION_PRODUCT.plan,
        name: SUBSCRIPTION_PRODUCT.name,
        description: SUBSCRIPTION_PRODUCT.description,
        price: SUBSCRIPTION_PRODUCT.priceInCents / 100,
        currency: 'usd',
        interval: SUBSCRIPTION_PRODUCT.interval,
        features: SUBSCRIPTION_PRODUCT.features,
      },
    };
  }

  /**
   * ADMIN — grant the calling admin a lifetime (non-Stripe) membership. The
   * member escape-hatch: lets you flip your own account to the uncapped
   * experience without going through Stripe, so the live entitlement path can
   * be tested. Admin-only; grants self. Idempotent (re-grant is a no-op).
   */
  @Post('admin/grant-membership')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async grantSelfMembership(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    await this.subscriptionRepository.grantLifetimeMembership(user.id, 'dev');
    return { message: `Lifetime membership granted to ${user.email}` };
  }

  /**
   * Create a checkout session for course purchase or subscription
   */
  @Post('checkout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponse> {
    // Validate course type if purchasing a course
    if (dto.type === 'course') {
      if (!dto.courseType) {
        throw new BadRequestException(
          'Course type is required for course purchases',
        );
      }
      if (!COURSE_PRODUCTS[dto.courseType]) {
        throw new BadRequestException('Invalid course type');
      }

      // Check if user already purchased this course
      const hasPurchased = await this.purchaseRepository.hasPurchasedCourse(
        user.id,
        dto.courseType,
      );
      if (hasPurchased) {
        throw new BadRequestException('You have already purchased this course');
      }
    }

    // Check if user already has active subscription
    if (dto.type === 'subscription') {
      const hasActiveSubscription =
        await this.subscriptionRepository.hasActiveSubscription(user.id);
      if (hasActiveSubscription) {
        throw new BadRequestException(
          'You already have an active subscription',
        );
      }
    }

    return this.stripeService.createCheckoutSession(user.id, user.email, dto);
  }

  /**
   * Create a customer portal session for subscription management
   */
  @Post('portal')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPortalSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: { returnUrl: string },
  ): Promise<CustomerPortalResponse> {
    const subscription = await this.subscriptionRepository.findByUserId(
      user.id,
    );

    if (!subscription) {
      throw new BadRequestException('No subscription found');
    }

    return this.stripeService.createCustomerPortalSession(
      subscription.stripeCustomerId,
      dto.returnUrl,
    );
  }

  /**
   * Get current user's access status (subscriptions and purchases)
   */
  @Get('access')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserAccess(
    @CurrentUser() user: AuthUser,
  ): Promise<UserAccessStatus> {
    const [subscription, purchasedCourses] = await Promise.all([
      this.subscriptionRepository.findByUserId(user.id),
      this.purchaseRepository.getPurchasedCourses(user.id),
    ]);

    const activeStatuses = ['active', 'trialing'];

    return {
      hasActiveSubscription: subscription
        ? activeStatuses.includes(subscription.status)
        : false,
      subscriptionStatus: subscription?.status,
      subscriptionEndDate: subscription?.currentPeriodEnd,
      purchasedCourses,
    };
  }

  /**
   * Cancel subscription at period end
   */
  @Post('cancel-subscription')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    const subscription = await this.subscriptionRepository.findByUserId(
      user.id,
    );

    if (!subscription) {
      throw new BadRequestException('No subscription found');
    }

    if (
      subscription.status !== 'active' &&
      subscription.status !== 'trialing'
    ) {
      throw new BadRequestException('Subscription is not active');
    }

    await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
    );

    return {
      message: 'Subscription will be canceled at the end of the billing period',
    };
  }

  /**
   * Reactivate a canceled subscription (before period ends)
   */
  @Post('reactivate-subscription')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async reactivateSubscription(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    const subscription = await this.subscriptionRepository.findByUserId(
      user.id,
    );

    if (!subscription) {
      throw new BadRequestException('No subscription found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not set to cancel');
    }

    await this.stripeService.reactivateSubscription(
      subscription.stripeSubscriptionId,
    );

    return { message: 'Subscription reactivated successfully' };
  }
}
