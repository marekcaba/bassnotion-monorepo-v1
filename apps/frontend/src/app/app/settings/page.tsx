'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Edit,
  Trash2,
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
import { DashboardContent } from '@/domains/user/components/DashboardContent/index';
import { LearningStyleSettings } from '@/domains/user/components/LearningStyleSettings';
import type { UserProfileData } from '@bassnotion/contracts';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useAuthStore } from '@/domains/user/hooks/use-auth';

function SettingsPageContent() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { logger } = useCorrelation('SettingsPage');
  const { profile } = useUserProfile();
  const resetAuth = useAuthStore((state) => state.reset);

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
    if (user && isAuthenticated) {
      loadProfileData();
    }
  }, [user, isAuthenticated]);

  const loadProfileData = async () => {
    try {
      const loadedProfile = await profileService.getCurrentProfile();
      setProfileData({
        displayName: loadedProfile.displayName,
        bio: loadedProfile.bio,
        avatarUrl: loadedProfile.avatarUrl,
      });
    } catch (error) {
      logger.error('Failed to load profile:', error);
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

        toast({
          title: 'Profile loading issue',
          description:
            'Using fallback profile data. You can edit your profile below.',
          variant: 'default',
        });
      }
    }
  };

  const handleProfileUpdate = useCallback(
    async (data: UserProfileData) => {
      try {
        await profileService.updateProfile(data);
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
    },
    [toast, logger],
  );

  const handleAvatarChange = useCallback(
    async (newAvatarUrl: string | null) => {
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
    },
    [profileData, toast, logger],
  );

  const handleAccountDeletion = useCallback(
    async (password: string) => {
      setIsDeleteLoading(true);
      try {
        await profileService.deleteAccount(password);
        await authService.signOut();
        resetAuth();

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
    },
    [resetAuth, toast, navigateWithTransition, logger],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your account and profile
        </p>
      </div>

      {/* Profile Section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Profile Information
          </h2>
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
                Account
              </h3>
              <div>
                <span className="font-medium text-gray-400">Email:</span>
                <p className="mt-1 break-all text-white">{user.email}</p>
              </div>
              <div>
                <span className="font-medium text-gray-400">Email Status:</span>
                <p className="mt-1">
                  {user.email_confirmed_at ? (
                    <span className="text-green-500">Confirmed</span>
                  ) : (
                    <span className="text-amber-500">Pending</span>
                  )}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-400">Member Since:</span>
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
                Profile
              </h3>
              {profileData && (
                <>
                  <div>
                    <span className="font-medium text-gray-400">
                      Display Name:
                    </span>
                    <p className="mt-1 text-white">{profileData.displayName}</p>
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

      {/* Learning Style Section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <LearningStyleSettings
          currentStyle={profile?.preferences?.learningStyle ?? 'free_flow'}
          onUpdate={loadProfileData}
        />
      </div>

      {/* Features & Animation Demo */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Features & Animation Demo
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Interactive Bassicology features with smooth layout animations powered
          by AutoAnimate
        </p>
        <DashboardContent />
      </div>

      {/* Admin Tools - Only visible for admins */}
      {profile?.role === 'admin' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-white">Admin Tools</h2>
          </div>
          <div className="rounded-lg border border-amber-800/30 bg-gradient-to-br from-amber-900/20 to-orange-900/10 p-4 sm:p-6">
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
                  <div className="text-xs text-gray-500">Manage content</div>
                </div>
              </button>
              <button
                onClick={() => navigateWithTransition('/admin/assessment/flow')}
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
                  <div className="text-xs text-gray-500">Instrument test</div>
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
      <div>
        <h2 className="text-lg font-semibold mb-4 text-white">
          Account Settings
        </h2>

        {/* Password Section */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6 mb-4">
          <h3 className="font-semibold mb-4 text-white">Password & Security</h3>
          <Button
            onClick={() => setShowPasswordDialog(true)}
            className="w-full sm:w-auto bg-[#ffc700] text-black hover:bg-[#e6b300]"
          >
            Change Password
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-4 sm:p-6">
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

      {/* Dialogs */}
      <ChangePasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />

      <DeleteAccountDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleAccountDeletion}
        isLoading={isDeleteLoading}
      />

      <ProfileEditDialog
        isOpen={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        initialData={profileData || { displayName: '', bio: '', avatarUrl: '' }}
        onSubmit={handleProfileUpdate}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageErrorBoundary pageName="Settings">
        <SettingsPageContent />
      </PageErrorBoundary>
    </>
  );
}
