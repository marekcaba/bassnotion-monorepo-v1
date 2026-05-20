import { createClient } from '@supabase/supabase-js';

import { isMockTestEnv, isWebkitBrowser } from '@/shared/utils/testEnv';

// Validate environment variables at module load time
// This ensures the app fails fast if configuration is missing
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

// Use minimal configuration in webkit under opt-in mock-test mode to
// prevent crashes in older specs.
const useMinimalConfig = isWebkitBrowser() && isMockTestEnv();

// Create the Supabase client with appropriate configuration
const createSupabaseClient = () => {
  // Get validated environment variables (already checked at module load)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Runtime check for extra safety (though already validated at module load)
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables are not properly configured',
    );
  }

  // For webkit E2E testing, return a completely mocked client
  if (useMinimalConfig) {
    // Create a minimal mock that prevents any actual network calls
    return {
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signUp: () =>
          Promise.resolve({ data: { user: null, session: null }, error: null }),
        signIn: () =>
          Promise.resolve({ data: { user: null, session: null }, error: null }),
        signInWithPassword: () =>
          Promise.resolve({ data: { user: null, session: null }, error: null }),
        signInWithOAuth: () =>
          Promise.resolve({
            data: { provider: 'google', url: null },
            error: null,
          }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => {
                // Mock unsubscribe method
              },
            },
          },
          error: null,
        }),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: [], error: null }),
        update: () => Promise.resolve({ data: [], error: null }),
        delete: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      debug: false,
      // Webkit-compatible storage configuration
      storage: isWebkitBrowser()
        ? {
            getItem: (key: string) => {
              try {
                return localStorage.getItem(key);
              } catch {
                return null; // Fallback if localStorage is blocked
              }
            },
            setItem: (key: string, value: string) => {
              try {
                localStorage.setItem(key, value);
              } catch {
                // Silently fail if localStorage is blocked in webkit
              }
            },
            removeItem: (key: string) => {
              try {
                localStorage.removeItem(key);
              } catch {
                // Silently fail if localStorage is blocked in webkit
              }
            },
          }
        : undefined,
    },
    global: {
      headers: {
        'x-client-info': '@supabase/auth-ui-react@latest',
      },
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        // Per-request timeout for Supabase fetches.
        //
        // History: previously 3s, which routinely tripped on cold queries
        // (PostgREST + RLS can legitimately take 1.5–2.5s) and surfaced as
        // `AbortError: signal is aborted without reason` in the console
        // because abort() was called without a reason.
        //
        // 15s is generous enough that genuinely-stuck requests still get
        // aborted, but normal slow queries (and slow-connection users) no
        // longer fail. Passing an explicit Error to abort() so the rejection
        // is identifiable in stack traces (vs the generic AbortError).
        const FETCH_TIMEOUT_MS = 15_000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort(
            new DOMException(
              `Supabase request timed out after ${FETCH_TIMEOUT_MS}ms`,
              'TimeoutError',
            ),
          );
        }, FETCH_TIMEOUT_MS);

        return globalThis
          .fetch(input, {
            ...init,
            signal: controller.signal,
          })
          .finally(() => {
            clearTimeout(timeoutId);
          });
      },
    },
    // Webkit-specific database configuration
    db: {
      schema: 'public',
    },
  });
};

// Export typed Supabase client
// The mock client in E2E mode returns a compatible interface
export const supabase = createSupabaseClient();
