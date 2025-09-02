import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Result } from '@/shared/types/result';
import { Tutorial } from '../entities/tutorial.entity';
import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import { TutorialLevel } from '../value-objects/tutorial-level.vo';
import { ResultTutorialRepository } from '../repositories/result-tutorial.repository';
import {
  PaginatedResult,
  PaginationOptions,
  TutorialFilters,
} from '../repositories/tutorial.repository.interface';

interface TutorialRepositoryState {
  // State
  tutorials: Map<string, Tutorial>;
  publishedTutorials: Tutorial[];
  isLoading: boolean;
  error: string | null;
  lastFetch: Date | null;
  
  // Pagination state
  currentPage: PaginatedResult<Tutorial> | null;
  publishedPage: PaginatedResult<Tutorial> | null;
  
  // Repository instance
  repository: ResultTutorialRepository;
  
  // Actions
  fetchById: (id: TutorialId) => Promise<Result<Tutorial>>;
  fetchBySlug: (slug: TutorialSlug) => Promise<Result<Tutorial>>;
  fetchAll: (options?: PaginationOptions) => Promise<Result<PaginatedResult<Tutorial>>>;
  fetchByLevel: (level: TutorialLevel) => Promise<Result<Tutorial[]>>;
  fetchByTag: (tag: string) => Promise<Result<Tutorial[]>>;
  fetchByAuthor: (authorName: string) => Promise<Result<Tutorial[]>>;
  search: (query: string, filters?: TutorialFilters) => Promise<Result<Tutorial[]>>;
  fetchPublished: (options?: PaginationOptions) => Promise<Result<PaginatedResult<Tutorial>>>;
  fetchRelated: (tutorialId: TutorialId, limit?: number) => Promise<Result<Tutorial[]>>;
  
  // Mutations
  save: (tutorial: Tutorial) => Promise<Result<Tutorial>>;
  update: (tutorial: Tutorial) => Promise<Result<Tutorial>>;
  delete: (id: TutorialId) => Promise<Result<void>>;
  
  // Batch operations
  saveMany: (tutorials: Tutorial[]) => Promise<Result<Tutorial[]>>;
  deleteMany: (ids: TutorialId[]) => Promise<Result<void>>;
  
  // Utility
  incrementViewCount: (id: TutorialId) => Promise<Result<void>>;
  clearCache: () => void;
  reset: () => void;
  
  // Getters
  getTutorialById: (id: string) => Tutorial | undefined;
  getTutorialBySlug: (slug: string) => Tutorial | undefined;
  getTutorialsByLevel: (level: TutorialLevel) => Tutorial[];
  getTutorialsByTag: (tag: string) => Tutorial[];
  getTutorialsByAuthor: (authorName: string) => Tutorial[];
}

const initialState = {
  tutorials: new Map<string, Tutorial>(),
  publishedTutorials: [],
  isLoading: false,
  error: null,
  lastFetch: null,
  currentPage: null,
  publishedPage: null,
};

export const useTutorialRepositoryStore = create<TutorialRepositoryState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      repository: new ResultTutorialRepository(),

      fetchById: async (id: TutorialId) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findById(id);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            tutorials.set(result.value!.id.value, result.value!);
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchBySlug: async (slug: TutorialSlug) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findBySlug(slug);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            tutorials.set(result.value!.id.value, result.value!);
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchAll: async (options?: PaginationOptions) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findAll(options);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.items.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return {
              tutorials,
              currentPage: result.value!,
              isLoading: false,
              lastFetch: new Date(),
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchByLevel: async (level: TutorialLevel) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByLevel(level);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchByTag: async (tag: string) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByTag(tag);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchByAuthor: async (authorName: string) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByAuthor(authorName);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      search: async (query: string, filters?: TutorialFilters) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.search(query, filters);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchPublished: async (options?: PaginationOptions) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findPublished(options);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.items.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return {
              tutorials,
              publishedTutorials: result.value!.items,
              publishedPage: result.value!,
              isLoading: false,
              lastFetch: new Date(),
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      fetchRelated: async (tutorialId: TutorialId, limit?: number) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findRelated(tutorialId, limit);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            result.value!.forEach(tutorial => {
              tutorials.set(tutorial.id.value, tutorial);
            });
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      save: async (tutorial: Tutorial) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.save(tutorial);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            tutorials.set(result.value!.id.value, result.value!);
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      update: async (tutorial: Tutorial) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.update(tutorial);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            tutorials.set(result.value!.id.value, result.value!);
            return { tutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      delete: async (id: TutorialId) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.delete(id);
        
        if (result.isSuccess) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            tutorials.delete(id.value);
            const publishedTutorials = state.publishedTutorials.filter(
              t => !t.id.equals(id)
            );
            return { tutorials, publishedTutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      saveMany: async (tutorials: Tutorial[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.saveMany(tutorials);
        
        if (result.isSuccess && result.value) {
          set((state) => {
            const tutorialsMap = new Map(state.tutorials);
            result.value!.forEach(tutorial => {
              tutorialsMap.set(tutorial.id.value, tutorial);
            });
            return { tutorials: tutorialsMap, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      deleteMany: async (ids: TutorialId[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.deleteMany(ids);
        
        if (result.isSuccess) {
          set((state) => {
            const tutorials = new Map(state.tutorials);
            ids.forEach(id => tutorials.delete(id.value));
            const publishedTutorials = state.publishedTutorials.filter(
              t => !ids.some(id => t.id.equals(id))
            );
            return { tutorials, publishedTutorials, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }
        
        return result;
      },

      incrementViewCount: async (id: TutorialId) => {
        const result = await get().repository.incrementViewCount(id);
        
        if (result.isSuccess) {
          // Optionally refresh the tutorial to get updated view count
          await get().fetchById(id);
        }
        
        return result;
      },

      clearCache: () => {
        get().repository.clearCache();
      },

      reset: () => {
        set(initialState);
      },

      getTutorialById: (id: string) => {
        return get().tutorials.get(id);
      },

      getTutorialBySlug: (slug: string) => {
        return Array.from(get().tutorials.values()).find(
          tutorial => tutorial.slug.value === slug
        );
      },

      getTutorialsByLevel: (level: TutorialLevel) => {
        return Array.from(get().tutorials.values()).filter(
          tutorial => tutorial.level.equals(level)
        );
      },

      getTutorialsByTag: (tag: string) => {
        return Array.from(get().tutorials.values()).filter(
          tutorial => tutorial.hasTag(tag)
        );
      },

      getTutorialsByAuthor: (authorName: string) => {
        return Array.from(get().tutorials.values()).filter(
          tutorial => tutorial.authorName === authorName
        );
      },
    }),
    {
      name: 'tutorial-repository-store',
    }
  )
);

// Convenience hooks
export const useTutorial = (id: string) => {
  const tutorial = useTutorialRepositoryStore(state => state.getTutorialById(id));
  const fetchById = useTutorialRepositoryStore(state => state.fetchById);
  const isLoading = useTutorialRepositoryStore(state => state.isLoading);
  const error = useTutorialRepositoryStore(state => state.error);

  return {
    tutorial,
    isLoading,
    error,
    refetch: () => fetchById(TutorialId.create(id)),
  };
};

export const useTutorialBySlug = (slug: string) => {
  const tutorial = useTutorialRepositoryStore(state => state.getTutorialBySlug(slug));
  const fetchBySlug = useTutorialRepositoryStore(state => state.fetchBySlug);
  const isLoading = useTutorialRepositoryStore(state => state.isLoading);
  const error = useTutorialRepositoryStore(state => state.error);

  return {
    tutorial,
    isLoading,
    error,
    refetch: () => fetchBySlug(TutorialSlug.create(slug)),
  };
};

export const useTutorials = (options?: PaginationOptions) => {
  const currentPage = useTutorialRepositoryStore(state => state.currentPage);
  const fetchAll = useTutorialRepositoryStore(state => state.fetchAll);
  const isLoading = useTutorialRepositoryStore(state => state.isLoading);
  const error = useTutorialRepositoryStore(state => state.error);

  return {
    tutorials: currentPage?.items || [],
    pagination: currentPage ? {
      total: currentPage.total,
      page: currentPage.page,
      limit: currentPage.limit,
      totalPages: currentPage.totalPages,
      hasNext: currentPage.hasNext,
      hasPrevious: currentPage.hasPrevious,
    } : null,
    isLoading,
    error,
    refetch: () => fetchAll(options),
  };
};

export const usePublishedTutorials = (options?: PaginationOptions) => {
  const publishedPage = useTutorialRepositoryStore(state => state.publishedPage);
  const fetchPublished = useTutorialRepositoryStore(state => state.fetchPublished);
  const isLoading = useTutorialRepositoryStore(state => state.isLoading);
  const error = useTutorialRepositoryStore(state => state.error);

  return {
    tutorials: publishedPage?.items || [],
    pagination: publishedPage ? {
      total: publishedPage.total,
      page: publishedPage.page,
      limit: publishedPage.limit,
      totalPages: publishedPage.totalPages,
      hasNext: publishedPage.hasNext,
      hasPrevious: publishedPage.hasPrevious,
    } : null,
    isLoading,
    error,
    refetch: () => fetchPublished(options),
  };
};