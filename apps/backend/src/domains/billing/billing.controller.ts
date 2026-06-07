import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { StripeService } from './services/stripe.service.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import { ProductRepository } from './repositories/product.repository.js';
import { ProductContentsRepository } from './repositories/product-contents.repository.js';
import { EntitlementService } from './services/entitlement.service.js';
import type {
  CreateCheckoutSessionDto,
  CheckoutSessionResponse,
  CustomerPortalResponse,
  UserAccessStatus,
  Product,
} from './types/billing.types.js';
import { COURSE_PRODUCTS } from './types/billing.types.js';

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
    private readonly productRepository: ProductRepository,
    private readonly productContentsRepository: ProductContentsRepository,
    private readonly entitlementService: EntitlementService,
  ) {}

  /**
   * Shape a Product for the public catalog. Omits stripe_price_id — checkout
   * resolves the price server-side from the product id, so the price id need
   * never reach the client.
   */
  private toPublicProduct(p: Product) {
    return {
      id: p.id,
      slug: p.slug,
      type: p.type,
      name: p.name,
      description: p.description,
      tagline: p.tagline,
      coverImageUrl: p.coverImageUrl,
      previewGrooveId: p.previewGrooveId,
      features: p.features,
      badge: p.badge,
      sortOrder: p.sortOrder,
      price: p.priceInCents / 100,
      priceInCents: p.priceInCents,
      currency: p.currency,
      // Whether checkout can actually run. Membership resolves its price
      // server-side; one-time products need a configured Stripe price. We
      // expose only the boolean — never the stripe_price_id itself.
      purchasable: p.type === 'membership' || !!p.stripePriceId,
      metadata: p.metadata,
    };
  }

  /**
   * Get the active product catalog (membership + packs + accelerator).
   * Public endpoint for the store. DB-backed (the `products` table).
   */
  @Get('products')
  @HttpCode(HttpStatus.OK)
  async getProducts() {
    const products = await this.productRepository.findAllActive();
    return { products: products.map((p) => this.toPublicProduct(p)) };
  }

  /**
   * Get one product by slug + its bundled contents (for the pack detail page).
   * Public — the "what's inside" list is catalog info; the content URLs stay
   * gated by the signer.
   */
  @Get('products/:slug')
  @HttpCode(HttpStatus.OK)
  async getProduct(@Param('slug') slug: string) {
    const product = await this.productRepository.findBySlug(slug);
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    const contents = await this.productContentsRepository.findByProductId(
      product.id,
    );
    return {
      product: this.toPublicProduct(product),
      contents: contents.map((c) => ({
        contentType: c.contentType,
        contentId: c.contentId,
        unlockDay: c.unlockDay,
        sortOrder: c.sortOrder,
        note: c.note,
      })),
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

    // Validate one-time product + block re-purchase of something already owned.
    if (dto.type === 'product') {
      if (!dto.productId) {
        throw new BadRequestException(
          'Product id is required for product purchases',
        );
      }
      const product = await this.productRepository.findById(dto.productId);
      if (!product || !product.isActive) {
        throw new BadRequestException('Invalid product');
      }
      const alreadyOwned = await this.purchaseRepository.hasPurchasedProduct(
        user.id,
        dto.productId,
      );
      if (alreadyOwned) {
        throw new BadRequestException('You already own this product');
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
    // Admins bypass gating everywhere (same rule the content/collections paths
    // use), so the store must treat them as owning every product — otherwise
    // an admin sees a pack as accessible in the sidebar but "not owned" on the
    // store. Single source of truth: resolve ownership here, not per-consumer.
    if (await this.entitlementService.isAdmin(user.id)) {
      const products = await this.productRepository.findAllActive();
      return {
        hasActiveSubscription: true,
        subscriptionStatus: 'active',
        subscriptionEndDate: undefined,
        purchasedCourses: [],
        purchasedProductIds: products.map((p) => p.id),
      };
    }

    const [subscription, purchasedCourses, purchasedProductIds] =
      await Promise.all([
        this.subscriptionRepository.findByUserId(user.id),
        this.purchaseRepository.getPurchasedCourses(user.id),
        this.purchaseRepository.getPurchasedProductIds(user.id),
      ]);

    const activeStatuses = ['active', 'trialing'];

    return {
      hasActiveSubscription: subscription
        ? activeStatuses.includes(subscription.status)
        : false,
      subscriptionStatus: subscription?.status,
      subscriptionEndDate: subscription?.currentPeriodEnd,
      purchasedCourses,
      purchasedProductIds,
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
