import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Result } from '@/shared/types/result';
import { Creator } from '../entities/creator.entity';
import { CreatorId } from '../value-objects/creator-id.vo';
import { ChannelUrl } from '../value-objects/channel-url.vo';
import { ResultCreatorRepository } from '../repositories/result-creator.repository';
import {
  PaginatedResult,
  PaginationOptions,
  CreatorFilters,
  CreatorSortOptions,
} from '../repositories/creator.repository.interface';

interface CreatorRepositoryState {
  // State
  creators: Map<string, Creator>;
  verifiedCreators: Creator[];
  topCreators: Creator[];
  isLoading: boolean;
  error: string | null;
  lastFetch: Date | null;

  // Pagination state
  currentPage: PaginatedResult<Creator> | null;
  verifiedPage: PaginatedResult<Creator> | null;

  // Repository instance
  repository: ResultCreatorRepository;

  // Actions
  fetchById: (id: CreatorId) => Promise<Result<Creator>>;
  fetchByChannelUrl: (channelUrl: ChannelUrl) => Promise<Result<Creator>>;
  fetchByChannelId: (channelId: string) => Promise<Result<Creator>>;
  fetchAll: (
    options?: PaginationOptions,
  ) => Promise<Result<PaginatedResult<Creator>>>;
  fetchByIds: (ids: CreatorId[]) => Promise<Result<Creator[]>>;
  search: (
    query: string,
    filters?: CreatorFilters,
  ) => Promise<Result<Creator[]>>;
  fetchStale: (
    hoursThreshold?: number,
    limit?: number,
  ) => Promise<Result<Creator[]>>;
  fetchVerified: (
    options?: PaginationOptions,
  ) => Promise<Result<PaginatedResult<Creator>>>;
  fetchTop: (
    sortBy: CreatorSortOptions,
    limit?: number,
  ) => Promise<Result<Creator[]>>;

  // Mutations
  save: (creator: Creator) => Promise<Result<Creator>>;
  update: (creator: Creator) => Promise<Result<Creator>>;
  delete: (id: CreatorId) => Promise<Result<void>>;

  // Batch operations
  saveMany: (creators: Creator[]) => Promise<Result<Creator[]>>;
  updateMany: (creators: Creator[]) => Promise<Result<Creator[]>>;
  deleteMany: (ids: CreatorId[]) => Promise<Result<void>>;

  // Stats operations
  updateStats: (
    id: CreatorId,
    stats: {
      subscriberCount?: number;
      videoCount?: number;
      viewCount?: number;
    },
  ) => Promise<Result<Creator>>;
  markAsFetched: (id: CreatorId) => Promise<Result<void>>;

  // Utility
  clearCache: () => void;
  reset: () => void;

  // Getters
  getCreatorById: (id: string) => Creator | undefined;
  getCreatorByChannelUrl: (url: string) => Creator | undefined;
  getCreatorsByCountry: (country: string) => Creator[];
  getStaleCreators: (hoursThreshold?: number) => Creator[];
}

const initialState = {
  creators: new Map<string, Creator>(),
  verifiedCreators: [],
  topCreators: [],
  isLoading: false,
  error: null,
  lastFetch: null,
  currentPage: null,
  verifiedPage: null,
};

export const useCreatorRepositoryStore = create<CreatorRepositoryState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      repository: new ResultCreatorRepository(),

      fetchById: async (id: CreatorId) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findById(id);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.set(result.value!.id.value, result.value!);
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchByChannelUrl: async (channelUrl: ChannelUrl) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByChannelUrl(channelUrl);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.set(result.value!.id.value, result.value!);
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchByChannelId: async (channelId: string) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByChannelId(channelId);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.set(result.value!.id.value, result.value!);
            return { creators, isLoading: false };
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
            const creators = new Map(state.creators);
            result.value!.items.forEach((creator) => {
              creators.set(creator.id.value, creator);
            });
            return {
              creators,
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

      fetchByIds: async (ids: CreatorId[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByIds(ids);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            result.value!.forEach((creator) => {
              creators.set(creator.id.value, creator);
            });
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      search: async (query: string, filters?: CreatorFilters) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.search(query, filters);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            result.value!.forEach((creator) => {
              creators.set(creator.id.value, creator);
            });
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchStale: async (hoursThreshold?: number, limit?: number) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findStale(hoursThreshold, limit);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            result.value!.forEach((creator) => {
              creators.set(creator.id.value, creator);
            });
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchVerified: async (options?: PaginationOptions) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findVerified(options);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            result.value!.items.forEach((creator) => {
              creators.set(creator.id.value, creator);
            });
            return {
              creators,
              verifiedCreators: result.value!.items,
              verifiedPage: result.value!,
              isLoading: false,
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchTop: async (sortBy: CreatorSortOptions, limit?: number) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findTop(sortBy, limit);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            result.value!.forEach((creator) => {
              creators.set(creator.id.value, creator);
            });
            return {
              creators,
              topCreators: result.value!,
              isLoading: false,
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      save: async (creator: Creator) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.save(creator);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.set(result.value!.id.value, result.value!);
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      update: async (creator: Creator) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.update(creator);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.set(result.value!.id.value, result.value!);
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      delete: async (id: CreatorId) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.delete(id);

        if (result.isSuccess) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.delete(id.value);
            const verifiedCreators = state.verifiedCreators.filter(
              (c) => !c.id.equals(id),
            );
            const topCreators = state.topCreators.filter(
              (c) => !c.id.equals(id),
            );
            return {
              creators,
              verifiedCreators,
              topCreators,
              isLoading: false,
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      saveMany: async (creators: Creator[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.saveMany(creators);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creatorsMap = new Map(state.creators);
            result.value!.forEach((creator) => {
              creatorsMap.set(creator.id.value, creator);
            });
            return { creators: creatorsMap, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      updateMany: async (creators: Creator[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.updateMany(creators);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creatorsMap = new Map(state.creators);
            result.value!.forEach((creator) => {
              creatorsMap.set(creator.id.value, creator);
            });
            return { creators: creatorsMap, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      deleteMany: async (ids: CreatorId[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.deleteMany(ids);

        if (result.isSuccess) {
          set((state) => {
            const creators = new Map(state.creators);
            ids.forEach((id) => creators.delete(id.value));
            const verifiedCreators = state.verifiedCreators.filter(
              (c) => !ids.some((id) => c.id.equals(id)),
            );
            const topCreators = state.topCreators.filter(
              (c) => !ids.some((id) => c.id.equals(id)),
            );
            return {
              creators,
              verifiedCreators,
              topCreators,
              isLoading: false,
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      updateStats: async (id: CreatorId, stats) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.updateStats(id, stats);

        if (result.isSuccess && result.value) {
          set((state) => {
            const creators = new Map(state.creators);
            creators.set(result.value!.id.value, result.value!);
            return { creators, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      markAsFetched: async (id: CreatorId) => {
        const result = await get().repository.markAsFetched(id);

        if (result.isSuccess) {
          // Optionally refresh the creator to get updated lastFetchedAt
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

      getCreatorById: (id: string) => {
        return get().creators.get(id);
      },

      getCreatorByChannelUrl: (url: string) => {
        return Array.from(get().creators.values()).find(
          (creator) => creator.channelUrl.value === url,
        );
      },

      getCreatorsByCountry: (country: string) => {
        return Array.from(get().creators.values()).filter(
          (creator) => creator.country === country,
        );
      },

      getStaleCreators: (hoursThreshold = 24) => {
        return Array.from(get().creators.values()).filter((creator) =>
          creator.isStale(hoursThreshold),
        );
      },
    }),
    {
      name: 'creator-repository-store',
    },
  ),
);

// Convenience hooks
export const useCreator = (id: string) => {
  const creator = useCreatorRepositoryStore((state) =>
    state.getCreatorById(id),
  );
  const fetchById = useCreatorRepositoryStore((state) => state.fetchById);
  const isLoading = useCreatorRepositoryStore((state) => state.isLoading);
  const error = useCreatorRepositoryStore((state) => state.error);

  return {
    creator,
    isLoading,
    error,
    refetch: () => fetchById(CreatorId.create(id)),
  };
};

export const useCreatorByChannelUrl = (url: string) => {
  const creator = useCreatorRepositoryStore((state) =>
    state.getCreatorByChannelUrl(url),
  );
  const fetchByChannelUrl = useCreatorRepositoryStore(
    (state) => state.fetchByChannelUrl,
  );
  const isLoading = useCreatorRepositoryStore((state) => state.isLoading);
  const error = useCreatorRepositoryStore((state) => state.error);

  return {
    creator,
    isLoading,
    error,
    refetch: () => fetchByChannelUrl(ChannelUrl.create(url)),
  };
};

export const useCreators = (options?: PaginationOptions) => {
  const currentPage = useCreatorRepositoryStore((state) => state.currentPage);
  const fetchAll = useCreatorRepositoryStore((state) => state.fetchAll);
  const isLoading = useCreatorRepositoryStore((state) => state.isLoading);
  const error = useCreatorRepositoryStore((state) => state.error);

  return {
    creators: currentPage?.items || [],
    pagination: currentPage
      ? {
          total: currentPage.total,
          page: currentPage.page,
          limit: currentPage.limit,
          totalPages: currentPage.totalPages,
          hasNext: currentPage.hasNext,
          hasPrevious: currentPage.hasPrevious,
        }
      : null,
    isLoading,
    error,
    refetch: () => fetchAll(options),
  };
};

export const useVerifiedCreators = (options?: PaginationOptions) => {
  const verifiedPage = useCreatorRepositoryStore((state) => state.verifiedPage);
  const fetchVerified = useCreatorRepositoryStore(
    (state) => state.fetchVerified,
  );
  const isLoading = useCreatorRepositoryStore((state) => state.isLoading);
  const error = useCreatorRepositoryStore((state) => state.error);

  return {
    creators: verifiedPage?.items || [],
    pagination: verifiedPage
      ? {
          total: verifiedPage.total,
          page: verifiedPage.page,
          limit: verifiedPage.limit,
          totalPages: verifiedPage.totalPages,
          hasNext: verifiedPage.hasNext,
          hasPrevious: verifiedPage.hasPrevious,
        }
      : null,
    isLoading,
    error,
    refetch: () => fetchVerified(options),
  };
};

export const useTopCreators = (sortBy: CreatorSortOptions, limit?: number) => {
  const topCreators = useCreatorRepositoryStore((state) => state.topCreators);
  const fetchTop = useCreatorRepositoryStore((state) => state.fetchTop);
  const isLoading = useCreatorRepositoryStore((state) => state.isLoading);
  const error = useCreatorRepositoryStore((state) => state.error);

  return {
    creators: topCreators,
    isLoading,
    error,
    refetch: () => fetchTop(sortBy, limit),
  };
};
