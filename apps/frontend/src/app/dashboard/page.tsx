'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Edit, Trash2, User } from 'lucide-react';
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

export default function DashboardPage() {
  const { user, session, isAuthenticated, isReady, reset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { navigateWithTransition } = useViewTransitionRouter();
  
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [profileData, setProfileData] = useState<{
    displayName: string;
    bio?: string;
    avatarUrl?: string;
  } | null>(null);

  useEffect(() => {
    // Redirect to login if not authenticated and auth is ready
    if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isReady, router]);

  useEffect(() => {
    // Load profile data when user is available
    if (user && isAuthenticated) {
      loadProfileData();
    }
  }, [user, isAuthenticated]);

  const loadProfileData = async () => {
    try {
      const profile = await profileService.getCurrentProfile();
      console.log('[Dashboard] Loaded profile:', profile);
      setProfileData({
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      });
      console.log('[Dashboard] Set profile data:', {
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
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
          description: 'Using fallback profile data. You can edit your profile below.',
          variant: 'default',
        });
      }
    }
  };

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
    navigateWithTransition('/');
  };

  const handleProfileUpdate = async (data: UserProfileData) => {
    try {
      const updatedUser = await profileService.updateProfile(data);
      setProfileData({
        displayName: data.displayName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
      });
      setShowProfileDialog(false);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Profile update error:', error);
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
        avatarUrl: newAvatarUrl || undefined,
      };
      
      await profileService.updateProfile(updatedData);
      setProfileData({
        ...profileData,
        avatarUrl: newAvatarUrl || undefined,
      });
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Avatar update error:', error);
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
      
      router.push('/');
    } catch (error) {
      console.error('Account deletion error:', error);
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
          {/* Welcome Section with Profile Information */}
          <div className="bg-card rounded-lg border p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-2">
                  Welcome back!
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base">
                  You're successfully signed in to BassNotion.
                </p>
              </div>
              {!showProfileDialog && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProfileDialog(true)}
                  className="flex-shrink-0"
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
                  <h3 className="font-semibold text-base mb-3">Account Information</h3>
                  <div>
                    <span className="font-medium text-muted-foreground">Email:</span>
                    <p className="mt-1 break-all">{user.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Email Status:</span>
                    <p className="mt-1">
                      {user.email_confirmed_at ? (
                        <span className="text-green-600">✓ Confirmed</span>
                      ) : (
                        <span className="text-amber-600">⏳ Pending</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Member Since:</span>
                    <p className="mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">User ID:</span>
                    <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{user.id}</p>
                  </div>
                </div>

                {/* Right Column - Profile Info */}
                <div className="space-y-3 text-sm">
                  <h3 className="font-semibold text-base mb-3">Profile Information</h3>
                  {profileData && (
                    <>
                      <div>
                        <span className="font-medium text-muted-foreground">Display Name:</span>
                        <p className="mt-1">{profileData.displayName}</p>
                      </div>
                      
                      <div>
                        <span className="font-medium text-muted-foreground">Bio:</span>
                        <p className="mt-1 text-muted-foreground">
                          {profileData.bio || 'No bio added yet'}
                        </p>
                      </div>
                      
                      <div>
                        <span className="font-medium text-muted-foreground">Profile Picture:</span>
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
            <h2 className="text-lg sm:text-xl font-semibold mb-4">
              🎸 Features & Animation Demo
            </h2>
            <div className="bg-card rounded-lg border p-4 sm:p-6">
              <p className="text-sm text-muted-foreground mb-4">
                Interactive BassNotion features with smooth layout animations powered by AutoAnimate
              </p>
              <DashboardContent />
            </div>
          </div>

          {/* Account Settings */}
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">
              Account Settings
            </h2>
            
            {/* Password Section */}
            <div className="bg-card rounded-lg border p-4 sm:p-6 mb-4">
              <h3 className="font-semibold mb-4">Password & Security</h3>
              <Button
                onClick={() => setShowPasswordDialog(true)}
                className="w-full sm:w-auto"
              >
                Change Password
              </Button>
            </div>

            {/* Danger Zone */}
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 sm:p-6">
              <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. Please be certain.
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
