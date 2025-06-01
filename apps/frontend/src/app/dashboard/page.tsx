'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { authService } from '@/domains/user/api/auth';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { ChangePasswordForm } from '@/domains/user/components/auth/ChangePasswordForm';
import { ResponsiveDebug } from '@/shared/components/ui/responsive-debug';

export default function DashboardPage() {
  const { user, session, isAuthenticated, isReady, reset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated and auth is ready
    if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isReady, router]);

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      reset();

      // Redirect to home - no need for success toast since it's obvious
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: 'Sign out failed',
        description: 'There was an error signing you out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  // Show loading state while auth is initializing
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting to login
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Add debug component for responsive testing */}
      <ResponsiveDebug showAlways={true} />

      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          {/* Mobile-first responsive header */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
            <h1 className="text-xl sm:text-2xl font-bold text-center sm:text-left">
              BassNotion Dashboard
            </h1>
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Button
                onClick={handleGoHome}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="bg-card rounded-lg border p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-2">
              Welcome back!
            </h2>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              You're successfully signed in to BassNotion.
            </p>

            {user && (
              <div className="space-y-2 text-xs sm:text-sm">
                <p className="break-all">
                  <strong>Email:</strong> {user.email}
                </p>
                <p className="break-all font-mono text-xs">
                  <strong>User ID:</strong> {user.id}
                </p>
                <p>
                  <strong>Email Confirmed:</strong>{' '}
                  {user.email_confirmed_at ? (
                    <span className="text-green-600">✓ Confirmed</span>
                  ) : (
                    <span className="text-amber-600">⏳ Pending</span>
                  )}
                </p>
                <p>
                  <strong>Account Created:</strong>{' '}
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Features Preview */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-card rounded-lg border p-4 sm:p-6">
              <h3 className="font-semibold mb-2 text-sm sm:text-base">
                Bass Exercises
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Practice with interactive bass exercises
              </p>
              <Button size="sm" disabled className="w-full sm:w-auto">
                Coming Soon
              </Button>
            </div>

            <div className="bg-card rounded-lg border p-4 sm:p-6">
              <h3 className="font-semibold mb-2 text-sm sm:text-base">
                Learning Progress
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Track your bass learning journey
              </p>
              <Button size="sm" disabled className="w-full sm:w-auto">
                Coming Soon
              </Button>
            </div>

            <div className="bg-card rounded-lg border p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
              <h3 className="font-semibold mb-2 text-sm sm:text-base">
                Community
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Connect with other bass players
              </p>
              <Button size="sm" disabled className="w-full sm:w-auto">
                Coming Soon
              </Button>
            </div>
          </div>

          {/* Account Settings */}
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">
              Account Settings
            </h2>
            {showPasswordForm ? (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordForm(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <ChangePasswordForm />
              </div>
            ) : (
              <Button
                onClick={() => setShowPasswordForm(true)}
                className="w-full sm:w-auto"
              >
                Change Password
              </Button>
            )}
          </div>

          {/* Debug Info */}
          <div className="mt-6 sm:mt-8 bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">
              Debug Information
            </h3>
            <div className="text-xs space-y-1 font-mono break-all">
              <p>
                Auth Status:{' '}
                {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
              </p>
              <p>Session: {session ? 'Active' : 'None'}</p>
              <p>User: {user ? 'Loaded' : 'None'}</p>
              <p>Auth Ready: {isReady ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
