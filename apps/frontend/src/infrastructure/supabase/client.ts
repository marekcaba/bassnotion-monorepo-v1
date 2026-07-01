import { createBrowserClient } from '@supabase/ssr';

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

  // Cookie-backed browser client (@supabase/ssr): the session lives in cookies (chunked +
  // base64url-encoded automatically) instead of localStorage, so the SERVER can read it (edge
  // middleware + server components — later SSR phases). createBrowserClient uses document.cookie
  // automatically in the browser, so no custom `cookies` handler is needed here, and it sets the
  // SSR-correct auth defaults internally (autoRefreshToken/persistSession/detectSessionInUrl/
  // flowType:'pkce') — we don't re-pass them. The old WebKit localStorage `storage` shim is gone:
  // its reason (session persistence) is now the cookie adapter, which try/catches internally.
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: 'sb-bn',
      // 'lax' (NOT 'strict'): 'strict' would drop the cookie on the OAuth/magic-link top-level
      // return, breaking those flows. 'lax' is the correct, safe default for auth cookies.
      sameSite: 'lax',
      // Only require Secure in production — localhost is http and would silently drop a Secure
      // cookie, logging you out on every reload.
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // No `domain` → HOST-ONLY (app.bassicology.com), matching today's origin-scoped session.
    },
    // base64url safely encodes any character in the cookie value (production recommendation).
    cookieEncoding: 'base64url',
    global: {
      headers: {
        'x-client-info': '@supabase/auth-ui-react@latest',
      },
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        // Reduce timeout globally to 3 seconds for faster UX
        const timeoutId = setTimeout(() => controller.abort(), 3000);

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
