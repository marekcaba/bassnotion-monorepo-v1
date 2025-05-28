'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { authService } from '@/domains/user/api/auth';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';

export default function DashboardPage() {
  const { user, session, isAuthenticated, isReady, reset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Redirect to login if not authenticated and auth is ready
    if (isReady && !isAuthenticated) {
      router.push('/login?returnTo=/dashboard');
    }
  }, [isAuthenticated, isReady, router]);

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      reset();

      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully.',
      });

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
      <div className="min-h-screen flex items-center justify-center">
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
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">BassNotion Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={handleGoHome} variant="outline">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl">
          {/* Welcome Section */}
          <div className="bg-card rounded-lg border p-6 mb-8">
            <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
            <p className="text-muted-foreground mb-4">
              You're successfully signed in to BassNotion.
            </p>

            {user && (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Bass Exercises</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Practice with interactive bass exercises
              </p>
              <Button size="sm" disabled>
                Coming Soon
              </Button>
            </div>

            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Learning Progress</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Track your bass learning journey
              </p>
              <Button size="sm" disabled>
                Coming Soon
              </Button>
            </div>

            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Community</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect with other bass players
              </p>
              <Button size="sm" disabled>
                Coming Soon
              </Button>
            </div>
          </div>

          {/* Debug Info */}
          <div className="mt-8 bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2">Debug Information</h3>
            <div className="text-xs space-y-1 font-mono">
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
 