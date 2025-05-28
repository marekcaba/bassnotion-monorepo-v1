'use client';

import { useEffect, ReactNode } from 'react';
import { authService } from '@/domains/user/api/auth';
import { useAuth } from '@/domains/user/hooks/use-auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setSession, setLoading, setInitialized, reset } = useAuth();

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        setLoading(true);

        const { session } = await authService.getCurrentSession();

        if (session) {
          setUser(session.user);
          setSession(session);
        } else {
          reset();
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        reset();
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);

      if (session) {
        setUser(session.user);
        setSession(session);
      } else {
        reset();
      }

      setLoading(false);
      setInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setLoading, setInitialized, reset]);

  return <>{children}</>;
}
