'use client';

import { useEffect } from 'react';
import {
  useUserRepositoryStore,
  useCurrentUser,
  useUserLoading,
  useUserError,
} from '../repositories';
import { Email } from '../value-objects/email.vo';

/**
 * Example component showing how to use the repository pattern
 */
export function UserProfileExample() {
  const currentUser = useCurrentUser();
  const isLoading = useUserLoading();
  const error = useUserError();

  const { loadCurrentUser, updateCurrentUser, refreshCurrentUser } =
    useUserRepositoryStore();

  useEffect(() => {
    // Load current user on mount
    loadCurrentUser();
  }, [loadCurrentUser]);

  const handleUpdateProfile = async () => {
    if (!currentUser) return;

    try {
      // Clone the user to maintain immutability
      const updatedUser = currentUser.clone();

      // Update using domain methods
      updatedUser.updateProfile('New Display Name', 'https://new-avatar.url');

      // Save through repository
      await updateCurrentUser(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleUpdateEmail = async (newEmail: string) => {
    if (!currentUser) return;

    try {
      // Validate email using value object
      const emailVO = Email.create(newEmail);

      // Clone and update
      const updatedUser = currentUser.clone();
      updatedUser.updateEmail(emailVO);

      // Save through repository
      await updateCurrentUser(updatedUser);
    } catch (error) {
      console.error('Failed to update email:', error);
    }
  };

  if (isLoading) {
    return <div>Loading user profile...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={refreshCurrentUser}>Retry</button>
      </div>
    );
  }

  if (!currentUser) {
    return <div>No user logged in</div>;
  }

  return (
    <div className="p-4">
      <h2>User Profile</h2>

      <div className="space-y-2">
        <p>ID: {currentUser.id}</p>
        <p>Email: {currentUser.email}</p>
        <p>Display Name: {currentUser.displayName}</p>
        <p>Role: {currentUser.role}</p>
        <p>Avatar: {currentUser.avatarUrl || 'None'}</p>
        <p>Active: {currentUser.isActive() ? 'Yes' : 'No'}</p>
        <p>
          Can Access Admin: {currentUser.canAccessAdminPanel() ? 'Yes' : 'No'}
        </p>
        <p>
          Profile Complete: {currentUser.hasCompletedProfile() ? 'Yes' : 'No'}
        </p>
      </div>

      <div className="mt-4 space-x-2">
        <button
          onClick={handleUpdateProfile}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Update Profile
        </button>

        <button
          onClick={() => handleUpdateEmail('newemail@example.com')}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Update Email
        </button>

        <button
          onClick={refreshCurrentUser}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
