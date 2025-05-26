import * as dotenv from 'dotenv';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Set up test environment variables
process.env['SUPABASE_URL'] = 'http://localhost:54321';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
process.env['NODE_ENV'] = 'test';

beforeAll(() => {
  // Load environment variables from .env.test if it exists
  dotenv.config({ path: '.env.test' });
  // Setup before all tests
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Cleanup after all tests
});
