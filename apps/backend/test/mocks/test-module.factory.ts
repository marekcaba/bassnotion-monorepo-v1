import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import {
  createMockDatabaseService,
  createMockAuthService,
  createMockAuthSecurityService,
  createMockConfigService,
  mockEnvVars,
} from './global-test-mocks.js';

/**
 * Factory for creating properly configured NestJS test modules
 * with all necessary mocks to prevent dependency injection failures
 */

// Mock service classes for dependency injection
export const MockDatabaseService = class {
  constructor() {
    return createMockDatabaseService();
  }
};

export const MockAuthService = class {
  constructor() {
    return createMockAuthService();
  }
};

export const MockAuthSecurityService = class {
  constructor() {
    return createMockAuthSecurityService();
  }
};

export const MockConfigService = class {
  constructor() {
    return createMockConfigService();
  }
};

/**
 * Creates a test module with all necessary providers mocked
 * to prevent "undefined in constructor" errors
 */
export async function createTestModule(
  providers: any[] = [],
): Promise<TestingModule> {
  // Ensure environment variables are set
  Object.entries(mockEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => mockEnvVars],
      }),
    ],
    providers: [
      // Mock ConfigService first - many other services depend on it
      {
        provide: ConfigService,
        useFactory: createMockConfigService,
      },
      // Mock DatabaseService - AuthSecurityService depends on it
      {
        provide: 'DatabaseService',
        useFactory: createMockDatabaseService,
      },
      // Mock AuthSecurityService
      {
        provide: 'AuthSecurityService',
        useFactory: createMockAuthSecurityService,
      },
      // Mock AuthService - Controllers and Guards depend on it
      {
        provide: 'AuthService',
        useFactory: createMockAuthService,
      },
      // Add any additional providers passed in
      ...providers,
    ],
  }).compile();

  return module;
}

/**
 * Creates a test module specifically for unit tests with isolated service testing
 */
export async function createUnitTestModule(
  ServiceClass: any,
  dependencies: Record<string, any> = {},
): Promise<TestingModule> {
  // Ensure environment variables are set
  Object.entries(mockEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  const defaultDependencies = {
    ConfigService: createMockConfigService(),
    DatabaseService: createMockDatabaseService(),
    AuthSecurityService: createMockAuthSecurityService(),
    AuthService: createMockAuthService(),
  };

  const mockProviders = Object.entries({
    ...defaultDependencies,
    ...dependencies,
  }).map(([key, value]) => ({
    provide: key,
    useValue: value,
  }));

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => mockEnvVars],
      }),
    ],
    providers: [ServiceClass, ...mockProviders],
  }).compile();

  return module;
}

/**
 * Creates a test module for integration tests with actual service interactions
 * but mocked external dependencies
 */
export async function createIntegrationTestModule(
  controllers: any[] = [],
  services: any[] = [],
  customProviders: any[] = [],
): Promise<TestingModule> {
  // Ensure environment variables are set
  Object.entries(mockEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => mockEnvVars],
      }),
    ],
    controllers,
    providers: [
      // Include actual services
      ...services,
      // Mock external dependencies
      {
        provide: ConfigService,
        useFactory: createMockConfigService,
      },
      {
        provide: 'DatabaseService',
        useFactory: createMockDatabaseService,
      },
      // Add custom providers
      ...customProviders,
    ],
  }).compile();

  return module;
}

/**
 * Sets up global test environment with proper mocking
 * Call this in your test setup files
 */
export function setupTestEnvironment(): void {
  // Set environment variables
  Object.entries(mockEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Mock external modules globally
  vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => createMockDatabaseService().supabase),
  }));

  // Mock node-fetch for HaveIBeenPwned API calls
  vi.mock('node-fetch', () => ({
    default: vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
      status: 200,
    }),
  }));

  console.log('✅ Test environment configured with comprehensive mocks');
}
