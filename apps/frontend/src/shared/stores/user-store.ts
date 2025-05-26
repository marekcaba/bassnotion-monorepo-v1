import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Client-side UI state managed by Zustand
interface UserUIState {
  // UI-specific state
  isProfileModalOpen: boolean;
  selectedTab: 'profile' | 'preferences' | 'security';
  isDarkMode: boolean;

  // Temporary form state
  profileFormData: {
    displayName: string;
    bio: string;
  } | null;

  // UI actions
  openProfileModal: () => void;
  closeProfileModal: () => void;
  setSelectedTab: (tab: 'profile' | 'preferences' | 'security') => void;
  toggleDarkMode: () => void;
  setProfileFormData: (data: { displayName: string; bio: string }) => void;
  clearProfileFormData: () => void;
}

export const useUserUIStore = create<UserUIState>()(
  devtools(
    (set) => ({
      // Initial state
      isProfileModalOpen: false,
      selectedTab: 'profile',
      isDarkMode: false,
      profileFormData: null,

      // Actions
      openProfileModal: () => set({ isProfileModalOpen: true }),
      closeProfileModal: () => set({ isProfileModalOpen: false }),
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setProfileFormData: (data) => set({ profileFormData: data }),
      clearProfileFormData: () => set({ profileFormData: null }),
    }),
    {
      name: 'user-ui-store',
    },
  ),
);

// Example of how to use both stores together in a component:
/*
import { useUser, useUpdateUserProfile } from '@/lib/hooks/use-api';
import { useUserUIStore } from '@/shared/stores/user-store';

function UserProfileComponent({ userId }: { userId: string }) {
  // Server state from React Query
  const { data: user, isLoading, error } = useUser(userId);
  const updateProfileMutation = useUpdateUserProfile();
  
  // Client state from Zustand
  const {
    isProfileModalOpen,
    selectedTab,
    profileFormData,
    openProfileModal,
    closeProfileModal,
    setProfileFormData,
    clearProfileFormData,
  } = useUserUIStore();
  
  const handleSaveProfile = async () => {
    if (!profileFormData || !user) return;
    
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        data: profileFormData,
      });
      
      // Clear form data and close modal on success
      clearProfileFormData();
      closeProfileModal();
    } catch (error) {
      // Handle error (React Query will handle retries automatically)
      console.error('Failed to update profile:', error);
    }
  };
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>{user.displayName}</h1>
      <button onClick={openProfileModal}>Edit Profile</button>
      
      {isProfileModalOpen && (
        <ProfileModal
          user={user}
          formData={profileFormData}
          onFormDataChange={setProfileFormData}
          onSave={handleSaveProfile}
          onClose={closeProfileModal}
          isLoading={updateProfileMutation.isPending}
        />
      )}
    </div>
  );
}
*/
