/**
 * Minimal test setup for real Tone.js tests
 * 
 * This setup file doesn't mock Tone.js to allow testing real behavior
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Next.js router (minimal)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    searchParams: new URLSearchParams(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client (minimal)
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Mock fetch for tests
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    blob: vi.fn().mockResolvedValue(new Blob()),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    clone: vi.fn(),
  });
}

// IMPORTANT: Do NOT mock AudioContext or Tone.js!
// We want to test real Tone.js behavior