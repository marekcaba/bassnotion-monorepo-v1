import { AuthError, Session, User } from '@supabase/supabase-js';
import { vi } from 'vitest';

interface AuthCredentials {
  email: string;
  password: string;
}

export const createMockSupabaseClient = () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };

  const mockSession: Session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser,
  };

  return {
    auth: {
      signUp: vi.fn().mockImplementation(({ email }: AuthCredentials) => {
        if (email === 'existing@example.com') {
          return {
            data: { user: null, session: null },
            error: new AuthError('User already registered', 400),
          };
        }
        return {
          data: {
            user: mockUser,
            session: mockSession,
          },
          error: null,
        };
      }),

      signInWithPassword: vi
        .fn()
        .mockImplementation(({ email, password }: AuthCredentials) => {
          if (email === 'test@example.com' && password === 'Password123!') {
            return {
              data: {
                user: mockUser,
                session: mockSession,
              },
              error: null,
            };
          }
          return {
            data: { user: null, session: null },
            error: new AuthError('Invalid login credentials', 400),
          };
        }),

      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
};
