import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mocked,
} from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WebhookController } from '../webhook.controller.js';
import { StripeService } from '../services/stripe.service.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { PurchaseRepository } from '../repositories/purchase.repository.js';
import type Stripe from 'stripe';

describe('WebhookController', () => {
  let controller: WebhookController;
  // Vitest provides its own Mocked<T> equivalent of jest.Mocked<T>.
  // The earlier `jest.Mocked<...>` annotations referenced a global
  // `jest` namespace that this project doesn't load.
  let stripeService: Mocked<StripeService>;
  let subscriptionRepository: Mocked<SubscriptionRepository>;
  let purchaseRepository: Mocked<PurchaseRepository>;

  // Mock data
  const mockUserId = 'user-123';
  const mockCustomerId = 'cus_test123';
  const mockSubscriptionId = 'sub_test123';
  const mockPaymentIntentId = 'pi_test123';
  const mockSessionId = 'cs_test123';

  beforeEach(() => {
    // Create mock services
    stripeService = {
      constructWebhookEvent: vi.fn(),
      getSubscription: vi.fn(),
    } as any;

    subscriptionRepository = {
      findByStripeSubscriptionId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as any;

    purchaseRepository = {
      create: vi.fn(),
      findByPaymentIntentId: vi.fn(),
      updateStatus: vi.fn(),
    } as any;

    controller = new WebhookController(
      stripeService,
      subscriptionRepository,
      purchaseRepository,
      {
        createIfMissing: vi.fn(),
        markWelcomeEmailSent: vi.fn(),
        countByMode: vi.fn(),
      } as any,
      { sendFounderWelcome: vi.fn() } as any,
      { get: vi.fn() } as any,
      { grantFounderMembershipByEmail: vi.fn() } as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleStripeWebhook', () => {
    const createMockRequest = (rawBody: Buffer | string) => ({
      rawBody,
    });

    it('should throw BadRequestException if signature is missing', async () => {
      const request = createMockRequest(Buffer.from('payload'));

      await expect(
        controller.handleStripeWebhook('', request as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if raw body is missing', async () => {
      const request = { rawBody: undefined };

      await expect(
        controller.handleStripeWebhook('sig_test', request as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid signature', async () => {
      const request = createMockRequest(Buffer.from('payload'));
      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        controller.handleStripeWebhook('invalid_sig', request as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return { received: true } for valid webhook', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        object: 'event',
        data: {
          object: {
            id: mockSessionId,
            mode: 'subscription',
            metadata: { user_id: mockUserId },
            customer: mockCustomerId,
          },
        },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = createMockRequest(Buffer.from('payload'));
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );

      const result = await controller.handleStripeWebhook(
        'sig_test',
        request as any,
      );

      expect(result).toEqual({ received: true });
    });

    it('should return { received: true } even if event handling fails', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        object: 'event',
        data: {
          object: {
            id: mockSessionId,
            mode: 'payment',
            metadata: { user_id: mockUserId, course_type: 'basic' },
            customer: mockCustomerId,
            payment_intent: mockPaymentIntentId,
            amount_total: 3900,
            currency: 'usd',
          },
        },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = createMockRequest(Buffer.from('payload'));
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      purchaseRepository.create.mockRejectedValue(new Error('DB error'));

      // Should not throw, should return received: true
      const result = await controller.handleStripeWebhook(
        'sig_test',
        request as any,
      );
      expect(result).toEqual({ received: true });
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('should create purchase record for course payment', async () => {
      const mockSession = {
        id: mockSessionId,
        object: 'checkout.session',
        mode: 'payment',
        metadata: { user_id: mockUserId, course_type: 'standard' },
        customer: mockCustomerId,
        payment_intent: mockPaymentIntentId,
        amount_total: 4900,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        created: Date.now() / 1000,
        livemode: false,
      } as unknown as Stripe.Checkout.Session;

      const mockEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        object: 'event',
        data: { object: mockSession },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      purchaseRepository.create.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(purchaseRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        stripeCustomerId: mockCustomerId,
        stripePaymentIntentId: mockPaymentIntentId,
        stripeCheckoutSessionId: mockSessionId,
        courseType: 'standard',
        productId: null,
        amount: 4900,
        currency: 'usd',
        status: 'completed',
      });
    });

    it('should not create purchase if user_id is missing', async () => {
      const mockSession = {
        id: mockSessionId,
        object: 'checkout.session',
        mode: 'payment',
        metadata: { course_type: 'basic' }, // Missing user_id
        customer: mockCustomerId,
        payment_intent: mockPaymentIntentId,
        amount_total: 3900,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        created: Date.now() / 1000,
        livemode: false,
      } as unknown as Stripe.Checkout.Session;

      const mockEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        object: 'event',
        data: { object: mockSession },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(purchaseRepository.create).not.toHaveBeenCalled();
    });

    it('should log but not create for subscription checkout (handled by subscription event)', async () => {
      const mockSession = {
        id: mockSessionId,
        object: 'checkout.session',
        mode: 'subscription',
        metadata: { user_id: mockUserId },
        customer: mockCustomerId,
        subscription: mockSubscriptionId,
        payment_status: 'paid',
        status: 'complete',
        created: Date.now() / 1000,
        livemode: false,
      } as unknown as Stripe.Checkout.Session;

      const mockEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        object: 'event',
        data: { object: mockSession },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );

      await controller.handleStripeWebhook('sig_test', request as any);

      // Should not call purchase create for subscription
      expect(purchaseRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    const createMockSubscription = (overrides = {}): Stripe.Subscription =>
      ({
        id: mockSubscriptionId,
        object: 'subscription',
        customer: mockCustomerId,
        status: 'active',
        metadata: { user_id: mockUserId },
        items: {
          object: 'list',
          data: [{ price: { id: 'price_123' } }],
          has_more: false,
          url: '/v1/subscription_items',
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        canceled_at: null,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        ...overrides,
      }) as unknown as Stripe.Subscription;

    it('should create new subscription if not exists', async () => {
      const mockSubscription = createMockSubscription();
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        object: 'event',
        data: { object: mockSubscription },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue(null);
      subscriptionRepository.create.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
          status: 'active',
        }),
      );
    });

    it('should update existing subscription', async () => {
      const mockSubscription = createMockSubscription({
        cancel_at_period_end: true,
        canceled_at: Math.floor(Date.now() / 1000),
      });

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.updated',
        object: 'event',
        data: { object: mockSubscription },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue({
        id: 'existing-sub',
        userId: mockUserId,
      } as any);
      subscriptionRepository.update.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        expect.objectContaining({
          cancelAtPeriodEnd: true,
        }),
      );
    });

    it('should resolve user from existing subscription if metadata missing', async () => {
      const mockSubscription = createMockSubscription({
        metadata: {}, // No user_id in metadata
      });

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.updated',
        object: 'event',
        data: { object: mockSubscription },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      // First lookup returns the subscription with userId
      subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue({
        id: 'existing-sub',
        userId: mockUserId,
        stripeSubscriptionId: mockSubscriptionId,
      } as any);
      subscriptionRepository.update.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(subscriptionRepository.update).toHaveBeenCalled();
    });

    it('should resolve user from customer if subscription lookup fails', async () => {
      const mockSubscription = createMockSubscription({
        metadata: {}, // No user_id in metadata
      });

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.updated',
        object: 'event',
        data: { object: mockSubscription },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      // Subscription not found by ID
      subscriptionRepository.findByStripeSubscriptionId.mockResolvedValueOnce(
        null,
      );
      // Found by customer ID
      subscriptionRepository.findByStripeCustomerId.mockResolvedValue({
        id: 'existing-sub',
        userId: mockUserId,
      } as any);
      // Second call finds the subscription
      subscriptionRepository.findByStripeSubscriptionId.mockResolvedValueOnce(
        null,
      );
      subscriptionRepository.create.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(
        subscriptionRepository.findByStripeCustomerId,
      ).toHaveBeenCalledWith(mockCustomerId);
    });

    it('should not process if user cannot be resolved', async () => {
      const mockSubscription = createMockSubscription({
        metadata: {}, // No user_id
      });

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.updated',
        object: 'event',
        data: { object: mockSubscription },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue(null);
      subscriptionRepository.findByStripeCustomerId.mockResolvedValue(null);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(subscriptionRepository.create).not.toHaveBeenCalled();
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should mark subscription as canceled', async () => {
      const mockSubscription = {
        id: mockSubscriptionId,
        object: 'subscription',
        customer: mockCustomerId,
        status: 'canceled',
        items: {
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/subscription_items',
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as unknown as Stripe.Subscription;

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.deleted',
        object: 'event',
        data: { object: mockSubscription },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      subscriptionRepository.update.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        expect.objectContaining({
          status: 'canceled',
        }),
      );
    });
  });

  describe('handleInvoicePaymentSucceeded', () => {
    it('should update subscription status to active on successful renewal', async () => {
      const mockInvoice: Stripe.Invoice = {
        id: 'in_test123',
        object: 'invoice',
        subscription: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'paid',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.Invoice;

      const mockSubscription = {
        id: mockSubscriptionId,
        object: 'subscription',
        customer: mockCustomerId,
        status: 'active',
        items: { object: 'list', data: [], has_more: false, url: '' },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as unknown as Stripe.Subscription;

      const mockEvent = {
        id: 'evt_test',
        type: 'invoice.payment_succeeded',
        object: 'event',
        data: { object: mockInvoice },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      stripeService.getSubscription.mockResolvedValue(mockSubscription);
      subscriptionRepository.update.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(stripeService.getSubscription).toHaveBeenCalledWith(
        mockSubscriptionId,
      );
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        expect.objectContaining({
          status: 'active',
        }),
      );
    });

    it('should not process invoice without subscription', async () => {
      const mockInvoice: Stripe.Invoice = {
        id: 'in_test123',
        object: 'invoice',
        subscription: null, // No subscription
        customer: mockCustomerId,
        status: 'paid',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.Invoice;

      const mockEvent = {
        id: 'evt_test',
        type: 'invoice.payment_succeeded',
        object: 'event',
        data: { object: mockInvoice },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(stripeService.getSubscription).not.toHaveBeenCalled();
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('should update subscription status to past_due on failed payment', async () => {
      const mockInvoice: Stripe.Invoice = {
        id: 'in_test123',
        object: 'invoice',
        subscription: mockSubscriptionId,
        customer: mockCustomerId,
        status: 'open',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.Invoice;

      const mockEvent = {
        id: 'evt_test',
        type: 'invoice.payment_failed',
        object: 'event',
        data: { object: mockInvoice },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      subscriptionRepository.update.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        { status: 'past_due' },
      );
    });
  });

  describe('handlePaymentIntentSucceeded', () => {
    it('should update purchase status to completed', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: mockPaymentIntentId,
        object: 'payment_intent',
        amount: 4900,
        currency: 'usd',
        status: 'succeeded',
        customer: mockCustomerId,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.PaymentIntent;

      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        object: 'event',
        data: { object: mockPaymentIntent },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      purchaseRepository.findByPaymentIntentId.mockResolvedValue({
        id: 'purchase-123',
        status: 'pending',
      } as any);
      purchaseRepository.updateStatus.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(purchaseRepository.updateStatus).toHaveBeenCalledWith(
        mockPaymentIntentId,
        'completed',
      );
    });

    it('should not update if purchase already completed', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: mockPaymentIntentId,
        object: 'payment_intent',
        amount: 4900,
        currency: 'usd',
        status: 'succeeded',
        customer: mockCustomerId,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.PaymentIntent;

      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        object: 'event',
        data: { object: mockPaymentIntent },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      purchaseRepository.findByPaymentIntentId.mockResolvedValue({
        id: 'purchase-123',
        status: 'completed', // Already completed
      } as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(purchaseRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should not update if purchase not found', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: mockPaymentIntentId,
        object: 'payment_intent',
        amount: 4900,
        currency: 'usd',
        status: 'succeeded',
        customer: mockCustomerId,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.PaymentIntent;

      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        object: 'event',
        data: { object: mockPaymentIntent },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      purchaseRepository.findByPaymentIntentId.mockResolvedValue(null);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(purchaseRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentIntentFailed', () => {
    it('should update purchase status to failed', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: mockPaymentIntentId,
        object: 'payment_intent',
        amount: 4900,
        currency: 'usd',
        status: 'requires_payment_method',
        customer: mockCustomerId,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as Stripe.PaymentIntent;

      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.payment_failed',
        object: 'event',
        data: { object: mockPaymentIntent },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      purchaseRepository.findByPaymentIntentId.mockResolvedValue({
        id: 'purchase-123',
        status: 'pending',
      } as any);
      purchaseRepository.updateStatus.mockResolvedValue({} as any);

      await controller.handleStripeWebhook('sig_test', request as any);

      expect(purchaseRepository.updateStatus).toHaveBeenCalledWith(
        mockPaymentIntentId,
        'failed',
      );
    });
  });

  describe('Unhandled events', () => {
    it('should log and acknowledge unhandled event types', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.created', // Unhandled event type
        object: 'event',
        data: { object: { id: 'cus_123' } },
        created: Date.now() / 1000,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      const request = { rawBody: Buffer.from('payload') };
      stripeService.constructWebhookEvent.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );

      const result = await controller.handleStripeWebhook(
        'sig_test',
        request as any,
      );

      expect(result).toEqual({ received: true });
      // No repository calls for unhandled events
      expect(subscriptionRepository.create).not.toHaveBeenCalled();
      expect(purchaseRepository.create).not.toHaveBeenCalled();
    });
  });
});

describe('WebhookController - Status Mapping', () => {
  let controller: WebhookController;

  beforeEach(() => {
    const stripeService = { constructWebhookEvent: vi.fn() } as any;
    const subscriptionRepository = {
      findByStripeSubscriptionId: vi.fn().mockResolvedValue(null),
      findByStripeCustomerId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    } as any;
    const purchaseRepository = {} as any;

    controller = new WebhookController(
      stripeService,
      subscriptionRepository,
      purchaseRepository,
      {
        createIfMissing: vi.fn(),
        markWelcomeEmailSent: vi.fn(),
        countByMode: vi.fn(),
      } as any,
      { sendFounderWelcome: vi.fn() } as any,
      { get: vi.fn() } as any,
      { grantFounderMembershipByEmail: vi.fn() } as any,
    );
  });

  it('should map all Stripe subscription statuses correctly', async () => {
    // Access private method through prototype
    const mapStripeStatus = (controller as any).mapStripeStatus.bind(
      controller,
    );

    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('canceled')).toBe('canceled');
    expect(mapStripeStatus('incomplete')).toBe('incomplete');
    expect(mapStripeStatus('incomplete_expired')).toBe('incomplete_expired');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('paused')).toBe('canceled'); // Mapped to canceled
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('unpaid')).toBe('unpaid');
    expect(mapStripeStatus('unknown_status' as any)).toBe('incomplete'); // Fallback
  });
});

describe('WebhookController - Edge Cases', () => {
  let controller: WebhookController;
  let stripeService: any;
  let subscriptionRepository: any;
  let purchaseRepository: any;

  beforeEach(() => {
    stripeService = { constructWebhookEvent: vi.fn() };
    subscriptionRepository = {
      findByStripeSubscriptionId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    purchaseRepository = {
      create: vi.fn(),
      findByPaymentIntentId: vi.fn(),
      updateStatus: vi.fn(),
    };

    controller = new WebhookController(
      stripeService,
      subscriptionRepository,
      purchaseRepository,
      {
        createIfMissing: vi.fn(),
        markWelcomeEmailSent: vi.fn(),
        countByMode: vi.fn(),
      } as any,
      { sendFounderWelcome: vi.fn() } as any,
      { get: vi.fn() } as any,
      { grantFounderMembershipByEmail: vi.fn() } as any,
    );
  });

  it('should handle checkout session with zero amount', async () => {
    const mockSession = {
      id: 'cs_test',
      object: 'checkout.session',
      mode: 'payment',
      metadata: { user_id: 'user-123', course_type: 'basic' },
      customer: 'cus_123',
      payment_intent: 'pi_123',
      amount_total: 0, // Free course or 100% discount
      currency: 'usd',
      payment_status: 'paid',
      status: 'complete',
      created: Date.now() / 1000,
      livemode: false,
    } as unknown as Stripe.Checkout.Session;

    const mockEvent = {
      id: 'evt_test',
      type: 'checkout.session.completed',
      object: 'event',
      data: { object: mockSession },
      created: Date.now() / 1000,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: '2025-02-24.acacia',
    };

    const request = { rawBody: Buffer.from('payload') };
    stripeService.constructWebhookEvent.mockReturnValue(
      mockEvent as unknown as Stripe.Event,
    );
    purchaseRepository.create.mockResolvedValue({});

    await controller.handleStripeWebhook('sig_test', request as any);

    expect(purchaseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 0,
      }),
    );
  });

  it('should handle subscription with missing price data gracefully', async () => {
    const mockSubscription = {
      id: 'sub_test',
      object: 'subscription',
      customer: 'cus_123',
      status: 'active',
      metadata: { user_id: 'user-123' },
      items: {
        object: 'list',
        data: [], // Empty items
        has_more: false,
        url: '/v1/subscription_items',
      },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      cancel_at_period_end: false,
      canceled_at: null,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    } as unknown as Stripe.Subscription;

    const mockEvent = {
      id: 'evt_test',
      type: 'customer.subscription.created',
      object: 'event',
      data: { object: mockSubscription },
      created: Date.now() / 1000,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: '2025-02-24.acacia',
    };

    const request = { rawBody: Buffer.from('payload') };
    stripeService.constructWebhookEvent.mockReturnValue(
      mockEvent as unknown as Stripe.Event,
    );
    subscriptionRepository.findByStripeSubscriptionId.mockResolvedValue(null);
    subscriptionRepository.create.mockResolvedValue({});

    await controller.handleStripeWebhook('sig_test', request as any);

    // Should still create subscription with empty price
    expect(subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stripePriceId: '',
      }),
    );
  });
});
