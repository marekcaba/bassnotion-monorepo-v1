import { vi } from 'vitest';

/**
 * Global Test Mocks for BassNotion Backend
 *
 * This file provides comprehensive mocks for all external dependencies
 * to enable fast, reliable, isolated unit and integration testing.
 */

// Mock Supabase Client
export const createMockSupabaseClient = () => {
  const createMockQuery = (mockData: any = { data: null, error: null }) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    strictlyLeft: vi.fn().mockReturnThis(),
    strictlyRight: vi.fn().mockReturnThis(),
    notStrictlyLeft: vi.fn().mockReturnThis(),
    notStrictlyRight: vi.fn().mockReturnThis(),
    adjacent: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockData),
    maybeSingle: vi.fn().mockResolvedValue(mockData),
    csv: vi.fn().mockResolvedValue(mockData),
    geojson: vi.fn().mockResolvedValue(mockData),
    explain: vi.fn().mockResolvedValue(mockData),
    rollback: vi.fn().mockResolvedValue(mockData),
    returns: vi.fn().mockResolvedValue(mockData),
    then: vi.fn().mockResolvedValue(mockData),
    count: vi.fn().mockResolvedValue({ data: 0, error: null }),
  });

  return {
    from: vi.fn().mockImplementation(() => createMockQuery()),
    rpc: vi.fn().mockImplementation(() => createMockQuery()),
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: 'https://accounts.google.com/oauth/authorize?...' },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://mock-storage-url.com/file.jpg' },
        }),
      }),
    },
    realtime: {
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
        unsubscribe: vi.fn().mockResolvedValue({ status: 'CLOSED' }),
      }),
    },
  };
};

// Mock DatabaseService
export const createMockDatabaseService = () => ({
  supabase: createMockSupabaseClient(),
  isReady: vi.fn().mockReturnValue(true),
  getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
  onModuleInit: vi.fn().mockResolvedValue(undefined),
});

// Mock AuthService
export const createMockAuthService = () => ({
  signup: vi.fn().mockResolvedValue({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'mock-token' },
  }),
  signin: vi.fn().mockResolvedValue({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'mock-token' },
  }),
  signout: vi.fn().mockResolvedValue({ success: true }),
  resetPassword: vi.fn().mockResolvedValue({ success: true }),
  refreshToken: vi.fn().mockResolvedValue({
    session: { access_token: 'new-mock-token' },
  }),
  validateToken: vi.fn().mockReturnValue({
    valid: true,
    user: { id: 'test-user-id', email: 'test@example.com' },
  }),
  supabase: createMockSupabaseClient(),
});

// Mock AuthSecurityService
export const createMockAuthSecurityService = () => ({
  checkPasswordSecurity: vi.fn().mockResolvedValue({
    isCompromised: false,
    breachCount: 0,
    source: 'HaveIBeenPwned',
  }),
  checkRateLimit: vi.fn().mockResolvedValue({
    isRateLimited: false,
    attemptsRemaining: 10,
    remainingTime: 0,
  }),
  checkAccountLockout: vi.fn().mockResolvedValue({
    isLocked: false,
    failedAttempts: 0,
    remainingTime: 0,
  }),
  recordLoginAttempt: vi.fn().mockResolvedValue(undefined),
  validatePassword: vi.fn().mockReturnValue({
    isValid: true,
    errors: [],
  }),
  getSecurityErrorMessage: vi.fn().mockReturnValue('Mock security error'),
  getSecurityInfo: vi.fn().mockResolvedValue({
    passwordStrength: 'strong',
    accountStatus: 'active',
    lastLogin: new Date(),
  }),
});

// Mock ConfigService
export const createMockConfigService = () => ({
  get: vi.fn().mockImplementation((key: string) => {
    const mockConfig: Record<string, any> = {
      NODE_ENV: 'test',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_KEY: 'mock-supabase-key',
      SUPABASE_ANON_KEY: 'mock-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      JWT_SECRET: 'mock-jwt-secret-for-testing',
      JWT_EXPIRY: '1h',
      PORT: 3000,
      API_PREFIX: 'api',
      RATE_LIMIT_TTL: 60,
      RATE_LIMIT_MAX: 100,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/test',
      FRONTEND_URL: 'http://localhost:3001',
    };
    return mockConfig[key];
  }),
  getOrThrow: vi.fn().mockImplementation((key: string) => {
    const value = createMockConfigService().get(key);
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" not found`);
    }
    return value;
  }),
});

// Mock HTTP Service (for external API calls)
export const createMockHttpService = () => ({
  get: vi.fn().mockResolvedValue({
    data: 'mock-response-data',
    status: 200,
    statusText: 'OK',
  }),
  post: vi.fn().mockResolvedValue({
    data: 'mock-response-data',
    status: 200,
    statusText: 'OK',
  }),
  put: vi.fn().mockResolvedValue({
    data: 'mock-response-data',
    status: 200,
    statusText: 'OK',
  }),
  delete: vi.fn().mockResolvedValue({
    data: 'mock-response-data',
    status: 200,
    statusText: 'OK',
  }),
  patch: vi.fn().mockResolvedValue({
    data: 'mock-response-data',
    status: 200,
    statusText: 'OK',
  }),
});

// Global test configuration
export const globalTestConfig = {
  imports: [
    {
      module: class MockConfigModule {},
      global: true,
    },
  ],
  providers: [
    {
      provide: 'DatabaseService',
      useFactory: createMockDatabaseService,
    },
    {
      provide: 'AuthService',
      useFactory: createMockAuthService,
    },
    {
      provide: 'AuthSecurityService',
      useFactory: createMockAuthSecurityService,
    },
    {
      provide: 'ConfigService',
      useFactory: createMockConfigService,
    },
    {
      provide: 'HttpService',
      useFactory: createMockHttpService,
    },
  ],
};

// Utility function to setup test module with all mocks
export const createMockedTestModule = async (testingModule: any) => {
  return testingModule
    .overrideProvider('DatabaseService')
    .useFactory({ factory: createMockDatabaseService })
    .overrideProvider('AuthService')
    .useFactory({ factory: createMockAuthService })
    .overrideProvider('AuthSecurityService')
    .useFactory({ factory: createMockAuthSecurityService })
    .overrideProvider('ConfigService')
    .useFactory({ factory: createMockConfigService })
    .compile();
};

// Mock HaveIBeenPwned API responses
export const mockHaveIBeenPwnedResponses = {
  compromised: '8c2c86d7f6c3f8e6a15c2d5e1b8c4f3e1d0a5b2c:147', // Password123! has been pwned 147 times
  safe: '', // Empty response means not found in breaches
  apiError: new Error('HaveIBeenPwned API temporarily unavailable'),
};

// Mock environment variables for tests
export const mockEnvVars = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'http://localhost:54321',
  // Valid mock JWT tokens (these are test tokens with proper structure)
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  SUPABASE_SERVICE_ROLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  SUPABASE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  JWT_SECRET: 'mock-jwt-secret-with-minimum-32-characters-for-testing',
  JWT_EXPIRY: '1h',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/test',
  PORT: '3000',
  API_PREFIX: 'api',
  RATE_LIMIT_TTL: '60',
  RATE_LIMIT_MAX: '100',
  FRONTEND_URL: 'http://localhost:3001',
  TEST_USER_EMAIL: 'test@example.com',
  TEST_USER_PASSWORD: 'SecureTestPassword123!',
};
