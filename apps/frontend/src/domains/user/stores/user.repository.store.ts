import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { IUserRepository } from '../repositories/user.repository.interface';
import { UserRepository } from '../repositories/user.repository';
import { CachedUserRepository } from '../repositories/cached-user.repository';
import { ResultUserRepository } from '../repositories/result-user.repository';
import { User } from '../entities/user.entity';
import { UserId } from '../value-objects/user-id.vo';
import { createStructuredLogger } from '@bassnotion/contracts';

interface UserRepositoryState {
  // State
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  
  // Repository instance
  repository: IUserRepository;
  
  // Actions
  loadCurrentUser: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  updateCurrentUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Repository access for components
  getRepository: () => IUserRepository;
}

const logger = createStructuredLogger('UserRepositoryStore');

// Create the repository stack
const createRepositoryStack = (): IUserRepository => {
  const baseRepository = new UserRepository();
  const cachedRepository = new CachedUserRepository(baseRepository);
  const resultRepository = new ResultUserRepository(cachedRepository);
  return resultRepository;
};

export const useUserRepositoryStore = create<UserRepositoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentUser: null,
      isLoading: false,
      error: null,
      repository: createRepositoryStack(),

      // Actions
      loadCurrentUser: async () => {
        const { repository } = get();
        set({ isLoading: true, error: null });

        try {
          const user = await repository.getCurrentUser();
          set({ currentUser: user, isLoading: false });
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.error('Failed to load current user', error as Error);
          set({ 
            currentUser: null, 
            error: errorMessage, 
            isLoading: false 
          });
        }
      },

      refreshCurrentUser: async () => {
        const { repository } = get();
        set({ isLoading: true, error: null });

        try {
          const user = await repository.refreshCurrentUser();
          set({ currentUser: user, isLoading: false });
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.error('Failed to refresh current user', error as Error);
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
        }
      },

      updateCurrentUser: async (user: User) => {
        const { repository } = get();
        set({ isLoading: true, error: null });

        try {
          await repository.update(user);
          set({ currentUser: user, isLoading: false });
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.error('Failed to update current user', error as Error);
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
          throw error;
        }
      },

      logout: async () => {
        const { repository } = get();
        set({ isLoading: true, error: null });

        try {
          await repository.logout();
          set({ 
            currentUser: null, 
            isLoading: false,
            error: null 
          });
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.error('Failed to logout', error as Error);
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
          throw error;
        }
      },

      setCurrentUser: (user: User | null) => {
        set({ currentUser: user });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      getRepository: () => {
        return get().repository;
      },
    }),
    {
      name: 'user-repository-store',
    }
  )
);

// Convenience hooks
export const useCurrentUser = () => useUserRepositoryStore(state => state.currentUser);
export const useUserRepository = () => useUserRepositoryStore(state => state.repository);
export const useUserLoading = () => useUserRepositoryStore(state => state.isLoading);
export const useUserError = () => useUserRepositoryStore(state => state.error);