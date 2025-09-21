import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  correlation,
  createCorrelatedAction,
  WithCorrelation,
} from './correlationMiddleware';

// Example of how to update the user store with correlation ID support

interface UserUIState {
  // UI-specific state
  isProfileModalOpen: boolean;
  selectedTab: 'profile' | 'preferences' | 'security';
  isDarkMode: boolean;
  profileFormData: {
    displayName: string;
    bio: string;
  } | null;

  // UI actions with correlation support
  openProfileModal: () => void;
  closeProfileModal: () => void;
  setSelectedTab: (tab: 'profile' | 'preferences' | 'security') => void;
  toggleDarkMode: () => void;
  setProfileFormData: (data: { displayName: string; bio: string }) => void;
  clearProfileFormData: () => void;
}

/**
 * Example of user store with correlation ID support
 *
 * This demonstrates how to:
 * 1. Add correlation middleware
 * 2. Use createCorrelatedAction for automatic correlation ID generation
 * 3. Access correlation IDs in components
 */
export const useUserUIStoreWithCorrelation = create<
  WithCorrelation<UserUIState>
>()(
  devtools(
    correlation(
      (set, get) => ({
        // Initial state
        isProfileModalOpen: false,
        selectedTab: 'profile',
        isDarkMode: false,
        profileFormData: null,

        // Actions with correlation
        openProfileModal: createCorrelatedAction(
          'UserUIStore',
          'openProfileModal',
          (get, set, correlationId) => {
            set({ isProfileModalOpen: true });
          },
        )(get, set),

        closeProfileModal: createCorrelatedAction(
          'UserUIStore',
          'closeProfileModal',
          (get, set, correlationId) => {
            set({ isProfileModalOpen: false });
          },
        )(get, set),

        setSelectedTab: createCorrelatedAction(
          'UserUIStore',
          'setSelectedTab',
          (
            get,
            set,
            correlationId,
            tab: 'profile' | 'preferences' | 'security',
          ) => {
            set({ selectedTab: tab });
          },
        )(get, set),

        toggleDarkMode: createCorrelatedAction(
          'UserUIStore',
          'toggleDarkMode',
          (get, set, correlationId) => {
            const currentState = get();
            set({ isDarkMode: !currentState.isDarkMode });
          },
        )(get, set),

        setProfileFormData: createCorrelatedAction(
          'UserUIStore',
          'setProfileFormData',
          (
            get,
            set,
            correlationId,
            data: { displayName: string; bio: string },
          ) => {
            set({ profileFormData: data });
          },
        )(get, set),

        clearProfileFormData: createCorrelatedAction(
          'UserUIStore',
          'clearProfileFormData',
          (get, set, correlationId) => {
            set({ profileFormData: null });
          },
        )(get, set),
      }),
      'UserUIStore', // Store name for logging
    ),
    {
      name: 'user-ui-store-with-correlation',
    },
  ),
);

/**
 * Example usage in a component:
 *
 * function UserProfileComponent() {
 *   const store = useUserUIStoreWithCorrelation();
 *   const { correlationId: componentCorrelationId, logger } = useCorrelation('UserProfile');
 *
 *   const handleOpenModal = () => {
 *     // The action automatically generates its own correlation ID
 *     store.openProfileModal();
 *
 *     // Or you can use withCorrelation for custom correlation
 *     store.withCorrelation((actionCorrelationId) => {
 *       logger.info('Opening profile modal', {
 *         correlationId: actionCorrelationId,
 *         componentCorrelationId,
 *       });
 *       store.openProfileModal();
 *       return actionCorrelationId;
 *     });
 *   };
 *
 *   // Access store's base correlation ID
 *   const storeCorrelationId = store.getCorrelationId();
 *
 *   return (
 *     <div>
 *       <button onClick={handleOpenModal}>Open Profile</button>
 *       {process.env.NODE_ENV === 'development' && (
 *         <div className="text-xs text-gray-500">
 *           Store ID: {storeCorrelationId}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 */
