'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Home,
  Edit,
  Trash2,
  Library,
  Settings,
  Shield,
  BookOpen,
  ClipboardCheck,
  Music,
  Activity,
} from 'lucide-react';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { authService } from '@/domains/user/api/auth';
import { profileService } from '@/domains/user/api/profile';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { ChangePasswordDialog } from '@/domains/user/components/auth/ChangePasswordDialog';
import { ProfileEditDialog } from '@/domains/user/components/ProfileEditDialog';
import { DeleteAccountDialog } from '@/domains/user/components/DeleteAccountDialog';
import { AvatarUpload } from '@/domains/user/components/AvatarUpload';
import { ResponsiveDebug } from '@/shared/components/ui/responsive-debug';
import { DashboardContent } from '@/domains/user/components/DashboardContent/index';
import type { UserProfileData } from '@bassnotion/contracts';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { HomeNavbar } from '../_components/HomeNavbar';
import { UserIndicator } from '@/domains/user/components/UserIndicator';

function DashboardPageContent() {
  const { user, session, isAuthenticated, isReady, reset } = useAuth();
  const _router = useRouter();
  const { toast } = useToast();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { redirectToLogin, redirectToHome } = useAuthRedirect();
  const { logger } = useCorrelation('DashboardPage');
  const { profile } = useUserProfile();

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [profileData, setProfileData] = useState<{
    displayName: string;
    bio?: string;
    avatarUrl?: string;
  } | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Don't redirect during sign out process - let the sign out handler control navigation
    // This prevents competing navigation that interrupts transitions
    // The auth guard at the app level will handle redirecting unauthenticated users
  }, [isAuthenticated, isReady, navigateWithTransition]);

  useEffect(() => {
    // Load profile data when user is available
    if (user && isAuthenticated) {
      loadProfileData();
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    // Redirect unauthenticated users to login, but only if not in sign out process
    if (isReady && !isAuthenticated && !isSigningOut) {
      redirectToLogin(); // Use scheduled redirect instead of immediate
    }
  }, [isAuthenticated, isReady, redirectToLogin, isSigningOut]);

  const loadProfileData = async () => {
    try {
      const profile = await profileService.getCurrentProfile();
      setProfileData({
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      });
    } catch (error) {
      logger.error('Failed to load profile:', error);
      // Use user data as fallback
      if (user) {
        const fallbackDisplayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User';

        setProfileData({
          displayName: fallbackDisplayName,
          bio: '',
          avatarUrl: '',
        });

        // Show a toast to inform the user
        toast({
          title: 'Profile loading issue',
          description:
            'Using fallback profile data. You can edit your profile below.',
          variant: 'default',
        });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true); // Prevent redirect during sign out AND keep component mounted
      await authService.signOut();
      reset();

      // Use scheduled redirect to allow auth state to settle
      redirectToHome(); // This will wait for auth state to settle before navigating

      // Reset signing out state after transition completes
      setTimeout(() => {
        setIsSigningOut(false);
      }, 200); // Slightly longer than redirect delay to ensure transition completes
    } catch (error) {
      logger.error('Sign out error:', error);
      setIsSigningOut(false); // Reset state on error
      toast({
        title: 'Sign out failed',
        description: 'There was an error signing you out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleGoHome = () => {
    navigateWithTransition('/');
  };

  const handleGoToLibrary = () => {
    navigateWithTransition('/library');
  };

  const handleGoToWurlitzerAdmin = () => {
    navigateWithTransition('/admin/instruments/wurlitzer');
  };

  const handleProfileUpdate = async (data: UserProfileData) => {
    try {
      const _updatedUser = await profileService.updateProfile(data);
      setProfileData({
        displayName: data.displayName,
        bio: data.bio ?? undefined,
        avatarUrl: data.avatarUrl,
      });
      setShowProfileDialog(false);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      logger.error('Profile update error:', error);
      toast({
        title: 'Failed to update profile',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarChange = async (newAvatarUrl: string | null) => {
    if (!profileData) return;

    try {
      const updatedData: UserProfileData = {
        displayName: profileData.displayName,
        bio: profileData.bio,
        avatarUrl: newAvatarUrl ?? undefined,
      };

      await profileService.updateProfile(updatedData);
      setProfileData({
        ...profileData,
        avatarUrl: newAvatarUrl ?? undefined,
      });

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      logger.error('Avatar update error:', error);
      toast({
        title: 'Failed to update avatar',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleAccountDeletion = async (password: string) => {
    setIsDeleteLoading(true);
    try {
      await profileService.deleteAccount(password);

      // Sign out and redirect to home
      await authService.signOut();
      reset();

      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted.',
        variant: 'success',
      });

      navigateWithTransition('/');
    } catch (error) {
      logger.error('Account deletion error:', error);
      toast({
        title: 'Failed to delete account',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Show loading state while auth is initializing
  if (!isReady) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(230 35% 10%) 40%, hsl(240 25% 5%) 100%)',
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffc700] mx-auto"></div>
          <p className="mt-2 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting to login
  if (!isAuthenticated && !isSigningOut) {
    return null;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(230 35% 10%) 40%, hsl(240 25% 5%) 100%)',
      }}
    >
      {/* Add debug component for responsive testing */}
      <ResponsiveDebug showAlways={true} />

      {/* Header with Logo and User Indicator */}
      <header className="w-full pt-8 sm:pt-12 pb-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Spacer for centering */}
          <div className="hidden sm:block w-[200px]" />

          {/* Logo - centered */}
          <button
            onClick={() => navigateWithTransition('/')}
            className="cursor-pointer"
          >
            <Image
              src="/BASSICOLOGY BIG.png"
              alt="Bassicology"
              width={600}
              height={150}
              className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
              priority
            />
          </button>

          {/* User Indicator with Logout - right side */}
          <div className="hidden sm:block">
            <UserIndicator />
          </div>
        </div>

        {/* Mobile User Indicator - below logo */}
        <div className="sm:hidden flex justify-center mt-4">
          <UserIndicator />
        </div>
      </header>

      {/* Navbar - use shared HomeNavbar component */}
      <HomeNavbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section with Profile Information */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-white">
                  Welcome back!
                </h2>
                <p className="text-gray-400 text-sm sm:text-base">
                  You're successfully signed in to Bassicology.
                </p>
              </div>
              {!showProfileDialog && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProfileDialog(true)}
                  className="flex-shrink-0 border-zinc-700 text-gray-300 hover:bg-zinc-800 hover:text-white"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>

            {user && (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column - Account Info */}
                <div className="space-y-3 text-sm">
                  <h3 className="font-semibold text-base mb-3 text-white">
                    Account Information
                  </h3>
                  <div>
                    <span className="font-medium text-gray-400">Email:</span>
                    <p className="mt-1 break-all text-white">{user.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">
                      Email Status:
                    </span>
                    <p className="mt-1">
                      {user.email_confirmed_at ? (
                        <span className="text-green-500">✓ Confirmed</span>
                      ) : (
                        <span className="text-amber-500">⏳ Pending</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">
                      Member Since:
                    </span>
                    <p className="mt-1 text-white">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">User ID:</span>
                    <p className="mt-1 font-mono text-xs break-all text-gray-500">
                      {user.id}
                    </p>
                  </div>
                </div>

                {/* Right Column - Profile Info */}
                <div className="space-y-3 text-sm">
                  <h3 className="font-semibold text-base mb-3 text-white">
                    Profile Information
                  </h3>
                  {profileData && (
                    <>
                      <div>
                        <span className="font-medium text-gray-400">
                          Display Name:
                        </span>
                        <p className="mt-1 text-white">
                          {profileData.displayName}
                        </p>
                      </div>

                      <div>
                        <span className="font-medium text-gray-400">Bio:</span>
                        <p className="mt-1 text-gray-400">
                          {profileData.bio || 'No bio added yet'}
                        </p>
                      </div>

                      <div>
                        <span className="font-medium text-gray-400">
                          Profile Picture:
                        </span>
                        <div className="mt-2">
                          {user?.id && (
                            <AvatarUpload
                              currentAvatarUrl={profileData.avatarUrl}
                              userId={user.id}
                              onAvatarChange={handleAvatarChange}
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Features with AutoAnimate Demo */}
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-white">
              Features & Animation Demo
            </h2>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6">
              <p className="text-sm text-gray-400 mb-4">
                Interactive Bassicology features with smooth layout animations
                powered by AutoAnimate
              </p>
              <DashboardContent />
            </div>
          </div>

          {/* Admin Tools - Only visible for admins */}
          {profile?.role === 'admin' && (
            <div className="mt-6 sm:mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Admin Tools
                </h2>
              </div>
              <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/10 rounded-lg border border-amber-800/30 p-4 sm:p-6">
                <p className="text-sm text-amber-200/70 mb-4">
                  Administrative tools and content management
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={() => navigateWithTransition('/admin/tutorials')}
                    className="flex items-center gap-3 p-4 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 hover:border-amber-600/50 transition-all group"
                  >
                    <BookOpen className="h-5 w-5 text-amber-500 group-hover:text-amber-400" />
                    <div className="text-left">
                      <div className="font-medium text-white text-sm">
                        Tutorials
                      </div>
                      <div className="text-xs text-gray-500">
                        Manage content
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      navigateWithTransition('/admin/assessment/flow')
                    }
                    className="flex items-center gap-3 p-4 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 hover:border-amber-600/50 transition-all group"
                  >
                    <ClipboardCheck className="h-5 w-5 text-amber-500 group-hover:text-amber-400" />
                    <div className="text-left">
                      <div className="font-medium text-white text-sm">
                        Assessment
                      </div>
                      <div className="text-xs text-gray-500">Flow editor</div>
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      navigateWithTransition('/admin/instruments/wurlitzer')
                    }
                    className="flex items-center gap-3 p-4 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 hover:border-amber-600/50 transition-all group"
                  >
                    <Music className="h-5 w-5 text-amber-500 group-hover:text-amber-400" />
                    <div className="text-left">
                      <div className="font-medium text-white text-sm">
                        Wurlitzer
                      </div>
                      <div className="text-xs text-gray-500">
                        Instrument test
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigateWithTransition('/admin/monitoring')}
                    className="flex items-center gap-3 p-4 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 hover:border-amber-600/50 transition-all group"
                  >
                    <Activity className="h-5 w-5 text-amber-500 group-hover:text-amber-400" />
                    <div className="text-left">
                      <div className="font-medium text-white text-sm">
                        Monitoring
                      </div>
                      <div className="text-xs text-gray-500">System health</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Settings */}
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-white">
              Account Settings
            </h2>

            {/* Password Section */}
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6 mb-4">
              <h3 className="font-semibold mb-4 text-white">
                Password & Security
              </h3>
              <Button
                onClick={() => setShowPasswordDialog(true)}
                className="w-full sm:w-auto bg-[#ffc700] text-black hover:bg-[#e6b300]"
              >
                Change Password
              </Button>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 sm:p-6">
              <h3 className="font-semibold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-400 mb-4">
                Once you delete your account, there is no going back. Please be
                certain.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </div>

          {/* Debug Info */}
          <div className="mt-6 sm:mt-8 bg-zinc-800 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-sm sm:text-base text-white">
              Debug Information
            </h3>
            <div className="text-xs space-y-1 font-mono break-all text-gray-400">
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

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleAccountDeletion}
        isLoading={isDeleteLoading}
      />

      {/* Profile Edit Dialog */}
      <ProfileEditDialog
        isOpen={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        initialData={profileData || { displayName: '', bio: '', avatarUrl: '' }}
        onSubmit={handleProfileUpdate}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageErrorBoundary pageName="Dashboard">
      <DashboardPageContent />
    </PageErrorBoundary>
  );
}
