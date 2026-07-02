'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { loginSchema, type LoginData } from '@bassnotion/contracts';

import { AuthErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Icons } from '@/shared/components/ui/icons';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { authService } from '@/domains/user/api/auth';
import { markJustLoggedIn } from '@/domains/user/components/auth/justLoggedIn';
import { safeRedirectPath } from '@/domains/user/components/auth/safeRedirect';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { useToast } from '@/shared/hooks/use-toast';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

const SALES_PAGE_GRADIENT =
  'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)';

function LoginPageContent() {
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const reason = searchParams.get('reason');
  // Optional post-login destination (?redirect=/gym). Validated to a safe in-app path so a crafted
  // link can't open-redirect; null → fall back to the default landing (Backstage). Used by every
  // login method below; the Google flow threads it through the OAuth callback (see handleGoogleSignIn).
  const redirectDest = safeRedirectPath(searchParams.get('redirect'));

  const { setUser, setSession, isAuthenticated, isReady } = useAuth();
  const { redirectAfterAuth, redirectToDashboard, scheduleRedirect } =
    useAuthRedirect();
  const { toast } = useToast();
  const { logger } = useCorrelation('LoginPage');

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (reason === 'idle') return;
    if (isReady && isAuthenticated) {
      logger.info('User already authenticated, redirecting');
      // Honor ?redirect= for an already-signed-in user too (e.g. a deep link
      // opened in a session that's still logged in), else the default landing.
      if (redirectDest) {
        scheduleRedirect(redirectDest);
      } else {
        redirectToDashboard();
      }
    }
  }, [
    isReady,
    isAuthenticated,
    reason,
    redirectDest,
    scheduleRedirect,
    redirectToDashboard,
    logger,
  ]);

  useEffect(() => {
    if (message === 'check-email') {
      toast({
        title: 'Check your email',
        description:
          'Please check your email and click the confirmation link before signing in.',
      });
    }
  }, [message, toast]);

  const useBackendAuth = process.env.NEXT_PUBLIC_USE_BACKEND_AUTH === 'true';

  const handleSubmit = async (data: LoginData) => {
    try {
      setIsLoading(true);
      if (!data.email || !data.password) {
        throw new Error('Email and password are required');
      }

      if (useBackendAuth) {
        const result = await authService.signInWithBackend(data);
        if (result.success) {
          markJustLoggedIn(); // welcome overlay fires once on landing
          // Land on the requested ?redirect= dest if present, else Backstage
          // (app host '/' rewrites to /app). The welcome overlay renders on
          // whichever /app page this lands on (it's scoped to the content pane).
          navigateWithTransition(redirectDest ?? '/');
        } else {
          throw new Error(
            result.message || result.error?.message || 'Login failed',
          );
        }
      } else {
        const authData = await authService.signIn(data);
        if (authData.user && authData.session) {
          markJustLoggedIn(); // welcome overlay fires once on landing
          setUser(authData.user);
          setSession(authData.session);
          redirectAfterAuth(authData.user, redirectDest);
        } else {
          throw new Error('Authentication failed - no user data received');
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to sign in. Please try again.';
      toast({
        title: 'Sign in failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      await authService.signInWithGoogle(redirectDest);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to sign in with Google',
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-[#E8E8E8] font-dm-body relative"
      style={{ background: SALES_PAGE_GRADIENT }}
    >
      {/* Top-left wordmark (fixed, matches sales-page nav exactly) */}
      <nav className="fixed top-0 left-0 right-0 z-[100] h-[72px] flex items-center justify-between px-6 md:px-[60px] bg-gradient-to-b from-[rgba(8,8,8,0.98)] to-transparent backdrop-blur-[8px]">
        <a
          href="/"
          aria-label="Bassicology home"
          className="flex items-start gap-1.5 no-underline cursor-pointer"
        >
          <div className="font-heading uppercase text-[22px] tracking-[0.12em] text-[#E8650A] leading-none">
            BASSICOLOGY
          </div>
          <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#666] border border-[#333] px-1.5 py-0.5 rounded-sm leading-none -translate-y-0.5">
            Beta
          </span>
        </a>
      </nav>

      {/* Main content — vertically + horizontally centered */}
      <main className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-[420px] space-y-10">
          {/* Heading */}
          <div className="text-center">
            <h1 className="font-heading uppercase text-[clamp(32px,4.5vw,44px)] leading-[0.95] tracking-[0.02em] text-[#E8E8E8]">
              Log in to <span className="text-[#E8650A]">Bassicology</span>
            </h1>
          </div>

          {/* Email + password (primary) */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#999]">
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={isLoading}
                        className="h-11 bg-[#0F0F0F] border-[#252525] text-[#E8E8E8] placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#E8650A] focus-visible:ring-offset-0 focus-visible:border-[#E8650A]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[12px] text-[#E8650A]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#999]">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          disabled={isLoading}
                          className="h-11 bg-[#0F0F0F] border-[#252525] text-[#E8E8E8] placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#E8650A] focus-visible:ring-offset-0 focus-visible:border-[#E8650A] pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          disabled={isLoading}
                          className="absolute right-0 top-0 h-full px-3 text-[#666] hover:text-[#E8E8E8] transition-colors"
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[12px] text-[#E8650A]" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center bg-[#E8650A] text-white rounded-sm text-[14px] font-semibold tracking-[0.04em] hover:bg-[#B84E08] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </Form>

          {/* Divider with "or" */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#252525]" />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-[10px] tracking-[0.18em] uppercase text-[#555]"
                style={{ background: 'hsl(240 5% 6%)' }}
              >
                or
              </span>
            </div>
          </div>

          {/* Google OAuth (secondary, under divider) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full h-12 flex items-center justify-center gap-3 bg-[#0F0F0F] border border-[#252525] text-[#E8E8E8] rounded-sm text-[14px] font-medium tracking-[0.02em] hover:bg-[#161616] hover:border-[#333] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icons.google className="h-4 w-4" />
            )}
            Continue with Google
          </button>

          {/* Footer links */}
          <div className="text-center space-y-2">
            <p className="text-[13px] text-[#999]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => navigateWithTransition('/register')}
                className="text-[#E8650A] hover:text-[#B84E08] transition-colors cursor-pointer"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthErrorBoundary>
      <Suspense
        fallback={
          <div
            className="min-h-screen"
            style={{ background: SALES_PAGE_GRADIENT }}
          />
        }
      >
        <LoginPageContent />
      </Suspense>
    </AuthErrorBoundary>
  );
}
