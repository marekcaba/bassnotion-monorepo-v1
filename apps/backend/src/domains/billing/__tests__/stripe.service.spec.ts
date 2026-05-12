import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../services/stripe.service.js';
import Stripe from 'stripe';

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = {
    products: {
      search: vi.fn(),
      create: vi.fn(),
    },
    prices: {
      list: vi.fn(),
      create: vi.fn(),
    },
    customers: {
      search: vi.fn(),
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    subscriptions: {
      update: vi.fn(),
      retrieve: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockStripe),
  };
});

describe('StripeService', () => {
  let stripeService: StripeService;
  let configService: ConfigService;
  let mockStripe: any;

  const mockCustomer: Stripe.Customer = {
    id: 'cus_test123',
    object: 'customer',
    email: 'test@example.com',
    metadata: { user_id: 'user-123' },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  } as Stripe.Customer;

  const mockProduct: Stripe.Product = {
    id: 'prod_test123',
    object: 'product',
    name: 'Test Product',
    metadata: { lookup_key: 'test_key' },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    active: true,
  } as Stripe.Product;

  const mockPrice: Stripe.Price = {
    id: 'price_test123',
    object: 'price',
    product: 'prod_test123',
    unit_amount: 1400,
    currency: 'usd',
    recurring: { interval: 'month' },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    active: true,
    type: 'recurring',
  } as Stripe.Price;

  const mockCheckoutSession: Stripe.Checkout.Session = {
    id: 'cs_test123',
    object: 'checkout.session',
    url: 'https://checkout.stripe.com/test',
    customer: 'cus_test123',
    mode: 'subscription',
    payment_status: 'unpaid',
    status: 'open',
    metadata: { user_id: 'user-123' },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  } as Stripe.Checkout.Session;

  const mockSubscription: Stripe.Subscription = {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    items: {
      object: 'list',
      data: [{ price: mockPrice }],
      has_more: false,
      url: '/v1/subscription_items',
    },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  } as Stripe.Subscription;

  beforeEach(() => {
    // Setup ConfigService mock
    configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_test123',
        };
        return config[key];
      }),
    } as any;

    // Create service instance (this will call the Stripe constructor)
    stripeService = new StripeService(configService);

    // Get mock Stripe instance
    mockStripe = (stripeService as any).stripe;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if STRIPE_SECRET_KEY is not provided', () => {
      const badConfigService = {
        get: vi.fn().mockReturnValue(undefined),
      } as any;

      expect(() => new StripeService(badConfigService)).toThrow(
        'STRIPE_SECRET_KEY is required',
      );
    });

    it('should create Stripe instance with correct API version', () => {
      expect(stripeService).toBeDefined();
    });
  });

  describe('onModuleInit', () => {
    it('should initialize prices on module init', async () => {
      // Mock product search (no existing products)
      mockStripe.products.search.mockResolvedValue({ data: [] });
      mockStripe.products.create.mockResolvedValue(mockProduct);
      mockStripe.prices.list.mockResolvedValue({ data: [] });
      mockStripe.prices.create.mockResolvedValue(mockPrice);

      await stripeService.onModuleInit();

      // Should create subscription product
      expect(mockStripe.products.create).toHaveBeenCalled();
      expect(mockStripe.prices.create).toHaveBeenCalled();
    });

    it('should reuse existing products if they exist', async () => {
      // Mock finding existing products
      mockStripe.products.search.mockResolvedValue({ data: [mockProduct] });
      mockStripe.prices.list.mockResolvedValue({ data: [mockPrice] });

      await stripeService.onModuleInit();

      // Should NOT create new products
      expect(mockStripe.products.create).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateCustomer', () => {
    it('should return existing customer if found', async () => {
      mockStripe.customers.search.mockResolvedValue({ data: [mockCustomer] });

      const result = await stripeService.getOrCreateCustomer(
        'user-123',
        'test@example.com',
        'Test User',
      );

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.search).toHaveBeenCalledWith({
        query: "metadata['user_id']:'user-123'",
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer if not found', async () => {
      mockStripe.customers.search.mockResolvedValue({ data: [] });
      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const result = await stripeService.getOrCreateCustomer(
        'user-123',
        'test@example.com',
        'Test User',
      );

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { user_id: 'user-123' },
      });
    });

    it('should handle customer creation without name', async () => {
      mockStripe.customers.search.mockResolvedValue({ data: [] });
      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      await stripeService.getOrCreateCustomer('user-123', 'test@example.com');

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: undefined,
        metadata: { user_id: 'user-123' },
      });
    });
  });

  describe('createCheckoutSession', () => {
    beforeEach(async () => {
      // Initialize prices first
      mockStripe.products.search.mockResolvedValue({ data: [mockProduct] });
      mockStripe.prices.list.mockResolvedValue({ data: [mockPrice] });
      await stripeService.onModuleInit();

      // Setup for checkout
      mockStripe.customers.search.mockResolvedValue({ data: [mockCustomer] });
      mockStripe.checkout.sessions.create.mockResolvedValue(mockCheckoutSession);
    });

    it('should create subscription checkout session', async () => {
      const result = await stripeService.createCheckoutSession('user-123', 'test@example.com', {
        type: 'subscription',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result).toEqual({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_test123',
          mode: 'subscription',
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
        }),
      );
    });

    it('should create course purchase checkout session', async () => {
      const result = await stripeService.createCheckoutSession('user-123', 'test@example.com', {
        type: 'course',
        courseType: 'basic',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.sessionId).toBe('cs_test123');

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          metadata: expect.objectContaining({
            user_id: 'user-123',
            course_type: 'basic',
          }),
        }),
      );
    });

    it('should throw error for invalid checkout type', async () => {
      await expect(
        stripeService.createCheckoutSession('user-123', 'test@example.com', {
          type: 'course', // course without courseType
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow('Invalid checkout session type');
    });

    it('should allow promotion codes in checkout', async () => {
      await stripeService.createCheckoutSession('user-123', 'test@example.com', {
        type: 'subscription',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          allow_promotion_codes: true,
        }),
      );
    });
  });

  describe('createCustomerPortalSession', () => {
    it('should create customer portal session', async () => {
      const mockPortalSession = {
        url: 'https://billing.stripe.com/portal',
      };
      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockPortalSession);

      const result = await stripeService.createCustomerPortalSession(
        'cus_test123',
        'https://example.com/billing',
      );

      expect(result).toEqual({ url: 'https://billing.stripe.com/portal' });
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        return_url: 'https://example.com/billing',
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const canceledSubscription = {
        ...mockSubscription,
        cancel_at_period_end: true,
      };
      mockStripe.subscriptions.update.mockResolvedValue(canceledSubscription);

      const result = await stripeService.cancelSubscription('sub_test123');

      expect(result.cancel_at_period_end).toBe(true);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: true,
      });
    });
  });

  describe('reactivateSubscription', () => {
    it('should reactivate a canceled subscription', async () => {
      mockStripe.subscriptions.update.mockResolvedValue(mockSubscription);

      const result = await stripeService.reactivateSubscription('sub_test123');

      expect(result.cancel_at_period_end).toBe(false);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: false,
      });
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription details', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await stripeService.getSubscription('sub_test123');

      expect(result).toEqual(mockSubscription);
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test123');
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct webhook event from payload', () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        type: 'checkout.session.completed',
        data: { object: mockCheckoutSession },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2025-02-24.acacia',
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = stripeService.constructWebhookEvent(
        'raw-payload',
        'stripe-signature',
      );

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'raw-payload',
        'stripe-signature',
        'whsec_test123',
      );
    });

    it('should throw error if webhook secret is not configured', () => {
      const badConfigService = {
        get: vi.fn((key: string) => {
          if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
          return undefined;
        }),
      } as any;

      const service = new StripeService(badConfigService);

      expect(() => service.constructWebhookEvent('payload', 'sig')).toThrow(
        'STRIPE_WEBHOOK_SECRET is required',
      );
    });

    it('should throw error for invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() =>
        stripeService.constructWebhookEvent('payload', 'invalid-sig'),
      ).toThrow('Invalid signature');
    });
  });

  describe('getCheckoutSession', () => {
    it('should retrieve checkout session with expanded fields', async () => {
      const expandedSession = {
        ...mockCheckoutSession,
        subscription: mockSubscription,
      };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue(expandedSession);

      const result = await stripeService.getCheckoutSession('cs_test123');

      expect(result).toEqual(expandedSession);
      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith(
        'cs_test123',
        { expand: ['subscription', 'payment_intent'] },
      );
    });
  });

  describe('getPriceIdForCourse', () => {
    it('should return price ID for valid course type', async () => {
      // Initialize prices
      mockStripe.products.search.mockResolvedValue({ data: [mockProduct] });
      mockStripe.prices.list.mockResolvedValue({ data: [mockPrice] });
      await stripeService.onModuleInit();

      const priceId = stripeService.getPriceIdForCourse('basic');

      expect(priceId).toBeDefined();
    });

    it('should return undefined for invalid course type', async () => {
      const priceId = stripeService.getPriceIdForCourse('invalid' as any);

      expect(priceId).toBeUndefined();
    });
  });

  describe('getSubscriptionPriceId', () => {
    it('should return subscription price ID after initialization', async () => {
      // Initialize prices
      mockStripe.products.search.mockResolvedValue({ data: [mockProduct] });
      mockStripe.prices.list.mockResolvedValue({ data: [mockPrice] });
      await stripeService.onModuleInit();

      const priceId = stripeService.getSubscriptionPriceId();

      expect(priceId).toBeDefined();
    });
  });
});

describe('StripeService - Error Handling', () => {
  let stripeService: StripeService;
  let mockStripe: any;

  beforeEach(() => {
    const configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_test123',
        };
        return config[key];
      }),
    } as any;

    stripeService = new StripeService(configService);
    mockStripe = (stripeService as any).stripe;
  });

  it('should propagate Stripe API errors', async () => {
    const stripeError = new Error('Stripe API error');
    mockStripe.customers.search.mockRejectedValue(stripeError);

    await expect(
      stripeService.getOrCreateCustomer('user-123', 'test@example.com'),
    ).rejects.toThrow('Stripe API error');
  });

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network error');
    mockStripe.subscriptions.retrieve.mockRejectedValue(networkError);

    await expect(stripeService.getSubscription('sub_123')).rejects.toThrow(
      'Network error',
    );
  });
});

describe('StripeService - Security', () => {
  let stripeService: StripeService;
  let mockStripe: any;

  beforeEach(() => {
    const configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_test123',
        };
        return config[key];
      }),
    } as any;

    stripeService = new StripeService(configService);
    mockStripe = (stripeService as any).stripe;
  });

  it('should always include user_id in checkout session metadata', async () => {
    // Initialize
    mockStripe.products.search.mockResolvedValue({ data: [] });
    mockStripe.products.create.mockResolvedValue({ id: 'prod_123' });
    mockStripe.prices.list.mockResolvedValue({ data: [] });
    mockStripe.prices.create.mockResolvedValue({ id: 'price_123' });
    await stripeService.onModuleInit();

    mockStripe.customers.search.mockResolvedValue({ data: [{ id: 'cus_123' }] });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com',
    });

    await stripeService.createCheckoutSession('user-123', 'test@example.com', {
      type: 'subscription',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ user_id: 'user-123' }),
      }),
    );
  });

  it('should always link customer to user via metadata', async () => {
    mockStripe.customers.search.mockResolvedValue({ data: [] });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_123' });

    await stripeService.getOrCreateCustomer('user-456', 'user@example.com');

    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { user_id: 'user-456' },
      }),
    );
  });
});
