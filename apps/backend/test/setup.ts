import { beforeEach, afterEach, afterAll, beforeAll, vi } from 'vitest';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupTestEnvironment } from './mocks/test-module.factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
config({ path: path.join(__dirname, '../.env.test') });

// Set up comprehensive test environment with all mocks
setupTestEnvironment();

// Global test state cleanup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
  vi.clearAllTimers();
});

// Ensure test environment is properly configured
beforeAll(() => {
  console.log('✅ Infrastructure test environment setup completed');
});

// Export common test utilities
export const TEST_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
};

// Common mock factories
export const createMockSupabaseClient = () => ({
  from: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue({ data: 0, error: null }),
  })),
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    refreshSession: vi.fn(),
  },
});

export const createMockDatabaseService = () => ({
  supabase: createMockSupabaseClient(),
  isReady: vi.fn().mockReturnValue(true),
  query: vi.fn(),
});

export const createMockConfigService = () => ({
  get: vi.fn().mockImplementation((key: string) => {
    const config = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRY: process.env.JWT_EXPIRY,
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    };
    return config[key as keyof typeof config];
  }),
  getOrThrow: vi.fn().mockImplementation((key: string) => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }),
});
